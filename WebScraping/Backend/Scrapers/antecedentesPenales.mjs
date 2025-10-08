import { chromium } from "playwright";
import { DatabaseOperations, Collections, ErrorLogsModel } from '../Models/database.js';

export const obtenerAntecedentesPenales = async (cedula) => {
  let browser = null;

  try {
    console.log(`🔍 Iniciando consulta de antecedentes penales para cédula: ${cedula}`);

    // Iniciar Playwright con evasión mejorada
    browser = await chromium.launch({
      headless: false, // Visible para noVNC
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--display=:99',
        '--disable-blink-features=AutomationControlled', // Oculta detección de automatización
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ],
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'es-EC',
      timezoneId: 'America/Guayaquil',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'es-EC,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      permissions: ['geolocation'],
      geolocation: { latitude: -0.1807, longitude: -78.4678 }, // Quito, Ecuador
    });

    // Ocultar webdriver
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    console.log(`🌐 Navegando a página de antecedentes penales...`);
    try {
      await page.goto('https://certificados.ministeriodelinterior.gob.ec/gestorcertificados/antecedentes/', {
        waitUntil: 'domcontentloaded', // Menos estricto que networkidle
        timeout: 90000, // Aumentado a 90 segundos
      });
    } catch (error) {
      console.error('⚠️ Error en page.goto:', error.message);
      const pageContent = await page.content();
      console.log('Contenido de la página:', pageContent.substring(0, 1000));
      throw new Error(`No se pudo cargar la página: ${error.message}`);
    }

    console.log(`📄 Página cargada. Título: ${await page.title()}`);

    // Verificar bloqueo de Incapsula
    const isIncapsulaBlocked = await page.evaluate(() => {
      return !!document.querySelector('#main-iframe') || document.body.innerHTML.includes('Incapsula');
    });

    if (isIncapsulaBlocked) {
      console.log('⚠️ Bloqueo de Incapsula detectado. Esperando resolución manual...');
      console.log('Abre noVNC para resolver el challenge de Incapsula (espera 10-30 segundos o interactúa).');

      let attempts = 0;
      const maxAttempts = 120; // 10 minutos
      while (attempts < maxAttempts) {
        const stillBlocked = await page.evaluate(() => {
          return !!document.querySelector('#main-iframe') || document.body.innerHTML.includes('Incapsula');
        });
        if (!stillBlocked) {
          console.log('✅ Bloqueo de Incapsula resuelto, continuando...');
          await page.waitForLoadState('domcontentloaded');
          break;
        }
        attempts++;
        await page.waitForTimeout(5000);
      }

      if (attempts >= maxAttempts) {
        await browser.close();
        return {
          success: false,
          error: 'incapsula_blocked',
          message: 'Se detectó un bloqueo de Incapsula. Resuélvelo mediante noVNC (espera o interactúa con la página).',
        };
      }
    }

    // Aceptar cookies
    try {
      await page.waitForSelector('.cc-btn.cc-dismiss', { timeout: 5000 });
      await page.click('.cc-btn.cc-dismiss');
      console.log(`✅ Cookies aceptadas`);
    } catch (e) {
      console.log(`ℹ️ No se encontró banner de cookies`);
    }

    // Verificar hCaptcha
    const isHCaptchaPresent = await page.evaluate(() => {
      return !!document.querySelector('div.h-captcha') || document.body.innerHTML.includes('hcaptcha');
    });

    if (isHCaptchaPresent) {
      console.log('⚠️ hCaptcha detectado. Esperando resolución manual...');
      console.log('Abre noVNC para resolver el hCaptcha.');

      let attempts = 0;
      const maxAttempts = 60; // 5 minutos
      while (attempts < maxAttempts) {
        const captchaStillPresent = await page.evaluate(() => {
          return !!document.querySelector('div.h-captcha') || document.body.innerHTML.includes('hcaptcha');
        });
        if (!captchaStillPresent) {
          console.log('✅ hCaptcha resuelto, continuando...');
          break;
        }
        attempts++;
        await page.waitForTimeout(5000);
      }

      if (attempts >= maxAttempts) {
        await browser.close();
        return {
          success: false,
          error: 'captcha_required',
          message: 'Se detectó un hCaptcha. Resuélvelo mediante noVNC.',
        };
      }
    }

    // Aceptar términos y condiciones
    console.log(`✅ Intentando aceptar términos y condiciones...`);
    try {
      await page.waitForSelector('button.ui-button-text-only:has-text("Aceptar")', { timeout: 15000 });
      await page.click('button.ui-button-text-only:has-text("Aceptar")');
      console.log(`✅ Términos aceptados`);
    } catch (e) {
      try {
        await page.waitForSelector('button:has-text("Aceptar")', { timeout: 15000 });
        await page.click('button:has-text("Aceptar")');
        console.log(`✅ Términos aceptados con selector alternativo`);
      } catch (e2) {
        console.log('⚠️ No se encontró el botón de aceptar términos. Inspeccionando...');
        const pageContent = await page.content();
        console.log('Contenido de la página:', pageContent.substring(0, 1000));
        throw new Error('No se encontró el botón de aceptar términos. Verifica el sitio en noVNC.');
      }
    }

    // Llenar cédula
    console.log(`📝 Llenando cédula: ${cedula}`);
    await page.waitForSelector('#txtCi', { timeout: 30000 });
    await page.fill('#txtCi', cedula);
    await page.click('#btnSig1');

    // Llenar motivo
    console.log(`📋 Llenando motivo de consulta...`);
    await page.waitForSelector('#txtMotivo', { timeout: 90000 });
    await page.fill('#txtMotivo', 'Consulta Personal');
    await page.waitForSelector('#btnSig2', { timeout: 90000 });
    await page.click('#btnSig2');

    // Obtener resultados
    await page.waitForSelector('#dvAntecedent1', { timeout: 30000 });
    const resultado = await page.textContent('#dvAntecedent1');
    const nombre = await page.textContent('#dvName1');

    const resultadoFormateado = resultado.trim().toUpperCase() === 'NO'
      ? 'No tiene antecedentes penales'
      : 'Tiene antecedentes penales';

    const tieneAntecedentes = resultado.trim().toUpperCase() !== 'NO';

    const datosAntecedentes = {
      cedula,
      nombre: nombre.trim(),
      resultado: resultadoFormateado,
      tieneAntecedentes,
      fechaConsulta: new Date(),
      estado: 'exitoso',
    };

    console.log(`✅ Consulta completada para ${nombre.trim()}: ${resultadoFormateado}`);

    // Guardar en base de datos
    await DatabaseOperations.upsert(
      Collections.ANTECEDENTES_PENALES,
      { cedula },
      datosAntecedentes
    );

    console.log(`💾 Datos guardados en base de datos para la cédula ${cedula}`);

    await browser.close();
    return datosAntecedentes;

  } catch (error) {
    console.error("\n❌ Error en obtenerAntecedentesPenales:", error.message);

    await ErrorLogsModel.saveError(
      'antecedentes-penales',
      cedula,
      'error_general',
      {
        mensaje: error.message || 'Error al consultar antecedentes penales',
        stack: error.stack,
        tipo: error.name || 'Error',
      }
    ).catch(err => console.warn('⚠️ Error guardando log:', err.message));

    if (browser) {
      await browser.close();
    }

    return {
      success: false,
      error: 'error_general',
      message: `Error al consultar antecedentes penales: ${error.message}`,
    };
  }
};