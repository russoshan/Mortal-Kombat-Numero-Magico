/* =============================================
   juego.js — Mortal Kombat: Adivina el Combo

   LÓGICA:
   - Barra Scorpion : baja 10% por cada intento fallido
   - Barra Sub-Zero : termómetro caliente/frío (proximidad)
   - Historial: muestra número + si era mayor o menor
   - Mensaje: se refresca en cada intento
   - Música : loop continuo desde que inicia el juego
============================================= */

$(document).ready(function () {

  /*VARIABLES DEL JUEGO*/
  var numeroSecreto;   // número a adivinar (1-100)
  var intentoActual;   // intento en curso, empieza en 1
  var juegoActivo;     // true = el jugador puede ingresar números
  var MAX_INTENTOS = 10;

  /* =============================================
     SPRITES DE SCORPION

     idle:    pose normal   → intentos 1-4
     ataque:  pose agresiva → intentos 5-7
     mareado: casi sin vida → intentos 8-10
     fall:    cae al suelo  → al perder (antes de pantalla final)
     win:     celebra       → al ganar  (antes de pantalla final)
  ============================================= */
  var SPRITE_SCORPION = {
    idle:    'img/scorpion-idle_.gif',
    ataque:  'img/scorpion-ataque.gif',
    mareado: 'img/scorpion-mareado.gif',
    fall:    'img/scorpion_fall.gif',
    win:     'img/scorpion_win.gif'
  };

  /* =============================================
     SPRITES DE SUB-ZERO

     ataque:  pose de combate normal → casi siempre
     mareado: Sub-Zero en peligro    → zona CALIENTE (distancia ≤ 5)
  ============================================= */
  var SPRITE_SUBZERO = {
    ataque:  'img/subzero-ataque.gif',
    mareado: 'img/subzero-mareado.gif'
  };

  /* =============================================
     GIFs DE PANTALLA FINAL

     victoria: usuario adivinó -> subzero_lose_scorpin_win.gif
     derrota:  usuario perdió  -> scorpion_lose_subzero_win.gif
  ============================================= */
  var GIF_FINAL = {
    victoria: 'img/subzero_lose_scorpin_win.gif',
    derrota:  'img/scorpion_lose_subzero_win.gif'
  };

  /* =============================================
     ZONAS DE PROXIMIDAD

     CALIENTE -> distancia ≤ 5   (muy cerca)
     TIBIO-> distancia 6-25  (relativamente cerca)
     FRÍO ->  distancia > 25  (lejos)

     Cada zona define: barra Sub-Zero, sonido, color del mensaje
  ============================================= */
  function obtenerZona(distancia) {
    if (distancia <= 5)  return 'CALIENTE';
    if (distancia <= 25) return 'TIBIO';
    return 'FRIO';
  }

  /* =============================================
     FUNCIÓN: reproducir audio
     Reinicia y reproduce el audio indicado.
     preload="auto" en el HTML
  ============================================= */
  function reproducir(idAudio) {
    var audio = document.getElementById(idAudio);
    audio.currentTime = 0;
    audio.play().catch(function () {}); // evita error de autoplay
  }

  /* =============================================
     FUNCIÓN: música de fondo en loop continuo
     Usa el audio de intro como música de fondo.
     loop=true hace que se repita automáticamente.
     Se inicia al presionar FIGHT y nunca se detiene
     hasta que se recarga la página.
  ============================================= */
  function iniciarMusica() {
    var musica = document.getElementById('audio-musica');
    musica.loop   = true;
    musica.volume = 0.4; 
    musica.currentTime = 0;
    musica.play().catch(function () {});
  }

  /* =============================================
     FUNCIÓN: actualizar barra de vida
     idBarra -> 'vida-scorpion' o 'vida-subzero'
     porcentaje -> 0 a 100
  ============================================= */
  function actualizarBarra(idBarra, porcentaje) {
    var dir = (idBarra === 'vida-subzero') ? '270deg' : '90deg';
    var color;

    if (porcentaje > 40) {
      color = 'linear-gradient(' + dir + ', #1a7a1a, #2ecc40)';
    } else if (porcentaje > 20) {
      color = 'linear-gradient(' + dir + ', #7a5a00, #e6a817)';
    } else {
      color = 'linear-gradient(' + dir + ', #7a0000, #e74c3c)';
    }

    $('#' + idBarra).css({ width: porcentaje + '%', background: color });
  }

  /* =============================================
     FUNCIÓN: barra de Sub-Zero como termómetro
     Refleja qué tan cerca está el jugador del número.
     También muestra un texto orientativo dentro de la barra.

       CALIENTE (≤5)  -> 10%  
       TIBIO    (6-25) -> 50%  
       FRÍO     (>25)  -> 100% 
       ACIERTO         -> 0%   
  ============================================= */
  function actualizarBarraSubzero(distancia) {
    var zona = obtenerZona(distancia);
    var porcentaje, texto;

    if (zona === 'CALIENTE') {
      porcentaje = 10;
      texto = '🔥 finish him';
    } else if (zona === 'TIBIO') {
      porcentaje = 50;
      texto = '🌡 tibio';
    } else {
      porcentaje = 100;
      texto = '❄ frío';
    }

    actualizarBarra('vida-subzero', porcentaje);
    $('#texto-proximidad').text(texto);
  }

  /* =============================================
     FUNCIÓN: mover luchadores según proximidad
     Más cerca del número -> personajes más juntos.
     distancia 0-99, avance máximo 80px.
  ============================================= */
  function moverLuchadores(distancia) {
    var avance = Math.floor((1 - distancia / 99) * 80);
    $('#img-scorpion').css('margin-left',  avance + 'px');
    $('#img-subzero') .css('margin-right', avance + 'px');
  }

  /* =============================================
     FUNCIÓN: sprite de Scorpion según intentos
     Cambia de aspecto a medida que gasta intentos:
       1-4:  idle    (fresco)
       5-7:  ataque  (agresivo)
       8-10: mareado (casi pierde)
  ============================================= */
  function actualizarSpriteScorpion() {
    if (intentoActual >= 8) {
      $('#img-scorpion').attr('src', SPRITE_SCORPION.mareado);
    } else if (intentoActual >= 5) {
      $('#img-scorpion').attr('src', SPRITE_SCORPION.ataque);
    } else {
      $('#img-scorpion').attr('src', SPRITE_SCORPION.idle);
    }
  }

  /* =============================================
     FUNCIÓN: efectos de zona (sonido + color + sprite Sub-Zero)

     CALIENTE (≤5)  -> "Finish Him" + rojo  + Sub-Zero mareado + sacudida
     TIBIO    (6-25) -> grito Scorpion + dorado + Sub-Zero ataque + sacudida
     FRÍO     (>25)  -> risa + azul + Sub-Zero ataque (cómodo, no se sacude)
  ============================================= */
  function aplicarEfectosZona(distancia) {
    var zona = obtenerZona(distancia);

    if (zona === 'CALIENTE') {
      reproducir('audio-finish');
      $('#mensaje').css('color', '#e74c3c');
      // Sub-Zero mareado: siente el peligro
      $('#img-subzero').attr('src', SPRITE_SUBZERO.mareado);
      $('#img-subzero').addClass('sacudir');
      setTimeout(function () { $('#img-subzero').removeClass('sacudir'); }, 380);

    } else if (zona === 'TIBIO') {
      reproducir('audio-golpe');
      $('#mensaje').css('color', '#f0c040');
      // Sub-Zero en ataque normal
      $('#img-subzero').attr('src', SPRITE_SUBZERO.ataque);
      $('#img-subzero').addClass('sacudir');
      setTimeout(function () { $('#img-subzero').removeClass('sacudir'); }, 380);

    } else {
      // FRÍO: Sub-Zero tranquilo en pose de ataque
      reproducir('audio-risa');
      $('#mensaje').css('color', '#6bb5e0');
      $('#img-subzero').attr('src', SPRITE_SUBZERO.ataque);
    }
  }

  /* =============================================
     FUNCIÓN: construir texto de pista
     Muestra el mensaje de caliente/frío + mayor/menor.
     Se reemplaza por completo en cada intento.

     Ejemplos:
       "FINISH HIM — ↓ MENOR QUE 78"
       "TIBIO — ↑ MAYOR QUE 30"
       "FRÍO — ↓ MENOR QUE 90"
  ============================================= */
  function construirMensaje(valor, distancia) {
    var zona = obtenerZona(distancia);
    var prefijo;

    if (zona === 'CALIENTE') {
      prefijo = '🔥 FINISH HIM';
    } else if (zona === 'TIBIO') {
      prefijo = '🌡 TIBIO';
    } else {
      prefijo = '❄ FRÍO';
    }

    var direccion = (valor < numeroSecreto)
      ? '↑ MAYOR QUE ' + valor
      : '↓ MENOR QUE ' + valor;

    // Se usa .text() para reemplazar, no .append()
    $('#mensaje').text(prefijo + ' — ' + direccion);
  }

  /* =============================================
     FUNCIÓN: agregar entrada al historial
     Cada chip muestra el número ingresado
     y si el número secreto era mayor o menor.

     Ejemplo: "80 ↓" significa que el secreto
     es MENOR que 80. "30 ↑" que es MAYOR que 30.
  ============================================= */
  function agregarChip(valor) {
    var flecha = (valor < numeroSecreto) ? ' ↑' : ' ↓';
    var chip = $('<span>').addClass('chip-intento').text(valor + flecha);
    $('#lista-intentos').append(chip);
  }

  /* =============================================
     FUNCIÓN: iniciar o reiniciar el juego
  ============================================= */
  function iniciarJuego() {
    numeroSecreto = Math.floor(Math.random() * 100) + 1;
    intentoActual = 1;
    juegoActivo   = true;

    // Reiniciar interfaz
    $('#mensaje').text('Descifra el combo de Sub-Zero (1–100)').css('color', '#f0c040');
    $('#lista-intentos').empty();
    $('#num-intento').text('1');
    $('#campo-numero').prop('disabled', false).val('');
    $('#btn-adivinar').prop('disabled', false);
    $('#btn-reiniciar').hide();
    $('#pantalla-final').hide();

    // Barras al 100%
    actualizarBarra('vida-scorpion', 100);
    actualizarBarra('vida-subzero',  100);
    $('#texto-proximidad').text(''); // limpiar texto de proximidad

    // Sprites idle al inicio
    $('#img-scorpion').attr('src', SPRITE_SCORPION.idle).css('margin-left',  '0');
    $('#img-subzero') .attr('src', SPRITE_SUBZERO.ataque).css('margin-right', '0');

    // Sonido de inicio (la música de fondo sigue corriendo)
    reproducir('audio-fight');
    $('#campo-numero').focus();
  }

  /* =============================================
     FUNCIÓN: terminar el juego
     gano = true  → victoria
     gano = false → derrota

     Secuencia (ambos casos):
       1. Cambiar sprite de Scorpion
       2. Reproducir audio final
       3. Esperar 1.8s (se ve la animación)
       4. Mostrar pantalla final
  ============================================= */
  function terminarJuego(gano) {
    juegoActivo = false;
    $('#campo-numero').prop('disabled', true);
    $('#btn-adivinar').prop('disabled', true);
    $('#btn-reiniciar').show();

    if (gano) {
      /* --- VICTORIA --- */
      $('#mensaje').text('¡FATALITY! ¡Combo descifrado!').css('color', '#f0c040').addClass('brillar');
      actualizarBarra('vida-subzero', 0);
      $('#img-scorpion').attr('src', SPRITE_SCORPION.win);
      reproducir('audio-fatality');

      setTimeout(function () {
        $('#gif-escena').attr('src', GIF_FINAL.victoria);
        $('#img-fatality-texto').show();
        $('#texto-resultado').text('¡Lo lograste en ' + (intentoActual - 1) + ' intento(s)!');
        $('#pantalla-final').css('display', 'flex');
      }, 1800);

    } else {
      /* --- DERROTA --- */
      $('#mensaje').text('K.O. — El combo era: ' + numeroSecreto).css('color', '#e74c3c');
      actualizarBarra('vida-scorpion', 0);
      $('#img-scorpion').attr('src', SPRITE_SCORPION.fall);
      reproducir('audio-subzero');

      setTimeout(function () {
        $('#gif-escena').attr('src', GIF_FINAL.derrota);
        $('#img-fatality-texto').hide();
        $('#texto-resultado').html(
          '<span class="texto-ko">YOU LOSE</span>' +
          '<span class="texto-numero">El número era: ' + numeroSecreto + '</span>'
        );
        $('#pantalla-final').css('display', 'flex');
      }, 1800);
    }
  }

  /* =============================================
     FUNCIÓN PRINCIPAL: verificar conjetura
     Se ejecuta al presionar ATACAR o Enter.

     Pasos en cada intento fallido:
       1. Agregar chip al historial (con flecha)
       2. Calcular distancia al número secreto
       3. Mover personajes
       4. Bajar vida de Scorpion (-10%)
       5. Actualizar barra Sub-Zero (termómetro)
       6. Efectos de zona (sonido + color)
       7. Sprite de Scorpion según intentos
       8. Mostrar mensaje de pista (reemplaza, no acumula)
       9. Avanzar contador
  ============================================= */
  function verificarConjetura() {
    if (!juegoActivo) return;

    var valor = parseInt($('#campo-numero').val(), 10);

    // Validar rango
    if (isNaN(valor) || valor < 1 || valor > 100) {
      $('#mensaje').text('⚠ Ingresa un número entre 1 y 100').css('color', '#f0c040');
      $('#campo-numero').val('');
      return;
    }

    // 1. Historial
    agregarChip(valor);

    // ¿Acierto?
    if (valor === numeroSecreto) {
      terminarJuego(true);
      return;
    }

    // 2. Distancia al número secreto
    var distancia = Math.abs(valor - numeroSecreto);

    // 3. Mover personajes
    moverLuchadores(distancia);

    // 4. Bajar vida Scorpion: 10% fijo por intento
    var vidaScorpion = ((MAX_INTENTOS - intentoActual) / MAX_INTENTOS) * 100;
    actualizarBarra('vida-scorpion', vidaScorpion);

    // 5. Barra Sub-Zero = termómetro de proximidad
    actualizarBarraSubzero(distancia);

    // 6. Sonido, color y sacudida según zona
    aplicarEfectosZona(distancia);

    // 7. Sprite de Scorpion según intentos gastados
    actualizarSpriteScorpion();

    // 8. Mensaje de pista (reemplaza el anterior, no acumula)
    construirMensaje(valor, distancia);

    // 9. Avanzar contador
    intentoActual++;

    // ¿Se agotaron los intentos?
    if (intentoActual > MAX_INTENTOS) {
      terminarJuego(false);
      return;
    }

    // Solo actualiza el display si el juego sigue
    $('#num-intento').text(intentoActual);

    $('#campo-numero').val('').focus();
  }

  /* =============================================
     EVENTOS
  ============================================= */

  // FIGHT: inicia música de fondo y muestra el juego
  $('#btn-start').on('click', function () {
    iniciarMusica();        // música en loop desde aquí
    reproducir('audio-fight'); // sonido "FIGHT!" puntual
    setTimeout(function () {
      $('#pantalla-intro').fadeOut(400, function () {
        $('#juego').fadeIn(400);
        iniciarJuego();
      });
    }, 800);
  });

  // Botón ATACAR
  $('#btn-adivinar').on('click', verificarConjetura);

  // Tecla Enter
  $('#campo-numero').on('keydown', function (e) {
    if (e.key === 'Enter') verificarConjetura();
  });

  // NUEVA BATALLA: reinicia sin cortar la música
  $('#btn-reiniciar').on('click', function () {
    $('#pantalla-final').hide();
    iniciarJuego();
  });

  // Clic en pantalla final la cierra
  $('#pantalla-final').on('click', function () {
    $(this).fadeOut(300);
  });

}); // fin document.ready
