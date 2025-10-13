import { chromium } from "playwright";
import { DatabaseOperations, Collections, ErrorLogsModel } from '../Models/database.js';

export const obtenerAntecedentesPenales = async (cedula) => {
  let browser = null;

  try {
    console.log(`🔍 Iniciando consulta para cédula: ${cedula}`);
    browser = await chromium.launch({
      headless: false,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--display=:99',
        '--disable-blink-features=AutomationControlled',
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
      geolocation: { latitude: -0.1807, longitude: -78.4678 },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    try {
      await page.goto('https://certificados.ministeriodelinterior.gob.ec/gestorcertificados/antecedentes/', {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
      await page.waitForLoadState('load', { timeout: 120000 }); // Asegurar que la página esté completamente cargada
    } catch (error) {
      console.error('⚠️ Error al cargar página:', error.message);
      const pageContent = await page.content().catch(() => 'No se pudo obtener el contenido de la página');
      console.log('Contenido de la página:', pageContent.substring(0, 1000));
      throw new Error(`No se pudo cargar la página: ${error.message}`);
    }

    console.log(`📄 Página cargada. Título: ${await page.title()}`);

    // Verificar bloqueo de Incapsula con manejo seguro
    const isIncapsulaBlocked = await page.evaluate(() => {
      if (!document.body) return false;
      return !!document.querySelector('#main-iframe') || document.body.innerHTML.includes('Incapsula');
    }).catch(() => {
      console.log('⚠️ Error al evaluar Incapsula, asumiendo no bloqueado');
      return false;
    });

    if (isIncapsulaBlocked) {
      console.log('⚠️ Bloqueo de Incapsula detectado.');
      let attempts = 0;
      const maxAttempts = 120;
      while (attempts < maxAttempts) {
        const stillBlocked = await page.evaluate(() => {
          if (!document.body) return false;
          return !!document.querySelector('#main-iframe') || document.body.innerHTML.includes('Incapsula');
        }).catch(() => false);
        if (!stillBlocked) {
          console.log('✅ Bloqueo de Incapsula resuelto.');
          await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
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
          message: 'Se detectó un bloqueo de Incapsula. Resuélvelo mediante noVNC.',
        };
      }
    }

    try {
      await page.waitForSelector('.cc-btn.cc-dismiss', { timeout: 5000 });
      await page.click('.cc-btn.cc-dismiss');
      console.log(`✅ Cookies aceptadas`);
    } catch (e) {
      console.log(`ℹ️ No se encontró banner de cookies`);
    }

    const isHCaptchaPresent = await page.evaluate(() => {
      if (!document.body) return false;
      return !!document.querySelector('div.h-captcha') || document.body.innerHTML.includes('hcaptcha');
    }).catch(() => {
      console.log('⚠️ Error al evaluar hCaptcha, asumiendo no presente');
      return false;
    });

    if (isHCaptchaPresent) {
      console.log('⚠️ hCaptcha detectado.');
      let attempts = 0;
      const maxAttempts = 60;
      while (attempts < maxAttempts) {
        const captchaStillPresent = await page.evaluate(() => {
          if (!document.body) return false;
          return !!document.querySelector('div.h-captcha') || document.body.innerHTML.includes('hcaptcha');
        }).catch(() => false);
        if (!captchaStillPresent) {
          console.log('✅ hCaptcha resuelto.');
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

    console.log(`✅ Intentando aceptar términos...`);
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
        console.log('⚠️ No se encontró botón de aceptar términos.');
        const pageContent = await page.content().catch(() => 'No se pudo obtener el contenido');
        console.log('Contenido de la página:', pageContent.substring(0, 1000));
        throw new Error('No se encontró el botón de aceptar términos.');
      }
    }

    console.log(`📝 Llenando cédula: ${cedula}`);
    try {
      await page.waitForSelector('#txtCi', { timeout: 30000 });
      await page.fill('#txtCi', cedula);
      await page.click('#btnSig1');
    } catch (error) {
      console.error('⚠️ Error al llenar cédula:', error.message);
      const pageContent = await page.content().catch(() => 'No se pudo obtener el contenido');
      console.log('Contenido de la página:', pageContent.substring(0, 1000));
      throw new Error('No se pudo llenar la cédula.');
    }

    console.log(`📋 Llenando motivo...`);
    try {
      await page.waitForSelector('#txtMotivo', { timeout: 30000 });
      await page.fill('#txtMotivo', 'Consulta Personal');
      await page.waitForSelector('#btnSig2', { timeout: 30000 });
      await page.click('#btnSig2');
    } catch (error) {
      console.error('⚠️ Error al llenar motivo:', error.message);
      const pageContent = await page.content().catch(() => 'No se pudo obtener el contenido');
      console.log('Contenido de la página:', pageContent.substring(0, 1000));
      throw new Error('No se pudo llenar el motivo.');
    }

    console.log(`📊 Obteniendo resultados...`);
    try {
      await page.waitForSelector('#dvAntecedent1', { timeout: 30000 });
      const resultado = await page.textContent('#dvAntecedent1');
      const nombre = await page.textContent('#dvName1');

      if (!resultado || !nombre) {
        const pageContent = await page.content().catch(() => 'No se pudo obtener el contenido');
        console.log('Contenido de la página:', pageContent.substring(0, 1000));
        throw new Error('No se encontraron los datos esperados (resultado o nombre).');
      }

      const resultadoFormateado = resultado.trim().toUpperCase() === 'NO'
        ? 'No tiene antecedentes penales'
        : 'Tiene antecedentes penales';

      const tieneAntecedentes = resultado.trim().toUpperCase() !== 'NO';

      const datosAntecedentes = {
        cedula,
        nombre: nombre.trim(),
        resultado: resultadoFormateado,
        tieneAntecedentes,
        fechaConsulta: new Date().toISOString(),
        estado: 'exitoso',
        success: true,
      };

      console.log(`✅ Consulta completada: ${JSON.stringify(datosAntecedentes)}`);

      await DatabaseOperations.upsert(
        Collections.ANTECEDENTES_PENALES,
        { cedula },
        datosAntecedentes
      );

      await browser.close();
      return datosAntecedentes;
    } catch (error) {
      console.error('⚠️ Error al obtener resultados:', error.message);
      throw error;
    }
  } catch (error) {
    console.error("\n❌ Error general:", error.message);

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