import { Command } from "commander";
import pc from "picocolors";
import {
  searchProducts,
  getProductById,
  getExchangeRate,
  fetchCities,
  fetchNearbyStores,
  getProductStockInStores,
  getDepartments,
  getProductOfferInfo,
  fetchOffers,
  fetchPromotionalBanners
} from "./api";
import { renderProductImage, openImageInBrowser } from "./image";
import { getGlyphs } from "./glyphs";
import { startCliSpinner } from "./spinner";
import { loadConfig, saveConfig } from "./config";
import type { FarmatodoProduct, Store } from "./types";

const NF = getGlyphs();

function formatBs(val: number): string {
  return `Bs. ${Number(val).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUsd(bs: number, rate: number): string {
  if (!rate || rate <= 0) return "$0.00";
  const usd = bs / rate;
  return `$${usd.toFixed(2)} USD`;
}

export async function runCLI(argv: string[]) {
  const program = new Command();
  const config = loadConfig();

  program
    .name("farmatodo")
    .description("CLI no oficial para Farmatodo Venezuela: buscador de medicamentos, precios, stock y farmacias.")
    .version("1.0.0");

  // COMANDO: BUSCAR
  program
    .command("buscar <termino>")
    .alias("s")
    .description("Buscar medicamentos o productos en Farmatodo Venezuela")
    .option("-c, --ciudad <codigo>", "Código de la ciudad (ej: CCS, VAL, MCBO, BQTO)", config.defaultCity)
    .option("-s, --en-stock", "Mostrar únicamente productos que tengan stock disponible")
    .option("-o, --ofertas", "Mostrar únicamente productos en oferta o con descuento")
    .option("-d, --departamento <nombre>", "Filtrar por departamento (ej: 'Salud y Medicamentos')")
    .option("-l, --limite <n>", "Número máximo de resultados", "15")
    .option("--json", "Mostrar el resultado en formato JSON puro")
    .action(async (termino, opts) => {
      const spinner = opts.json ? null : startCliSpinner(`Buscando "${termino}" en Farmatodo...`);
      try {
        const hitsPerPage = parseInt(opts.limite, 10) || 15;
        const [searchResult, rate] = await Promise.all([
          searchProducts({
            query: termino,
            hitsPerPage,
            department: opts.departamento,
            onlyInStock: opts.enStock,
            onlyOffers: opts.ofertas
          }),
          getExchangeRate()
        ]);

        if (spinner) spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify({ tasaBsPorDolar: rate, ...searchResult }, null, 2));
          return;
        }

        console.log("");
        console.log(
          pc.bold(pc.blue(`${NF.cross} Farmatodo Venezuela`)) +
          pc.gray(` | Tasa oficial: `) +
          pc.yellow(pc.bold(`Bs. ${rate.toFixed(2)} / $`)) +
          pc.gray(` | Ciudad: `) +
          pc.cyan(opts.ciudad.toUpperCase())
        );
        console.log(pc.gray(`Resultados para: "${pc.bold(termino)}"${opts.ofertas ? " [En Oferta]" : ""} (${searchResult.nbHits} productos encontrados)`));
        console.log(pc.gray("―".repeat(78)));

        if (searchResult.hits.length === 0) {
          console.log(pc.yellow(`\n${NF.warning} No se encontraron productos para "${termino}".`));
          console.log(pc.gray("Sugerencia: intenta buscar con un término más genérico o revisa la ortografía.\n"));
          return;
        }

        searchResult.hits.forEach((p: FarmatodoProduct, idx: number) => {
          const num = pc.gray(`${(idx + 1).toString().padStart(2, " ")}. `);
          const title = pc.bold(p.mediaDescription);
          const brand = p.marca ? pc.gray(` [${p.marca}]`) : "";
          const id = pc.dim(`(#${p.id})`);

          const offerInfo = getProductOfferInfo(p, opts.ciudad, rate);
          let priceFormatted = "";
          let offerBadge = "";

          if (offerInfo.hasOffer) {
            offerBadge = ` ${pc.bgGreen(pc.black(pc.bold(` -${offerInfo.discountText} `)))}`;
            const origBs = pc.strikethrough(pc.gray(formatBs(offerInfo.originalPrice)));
            const offerBs = pc.green(pc.bold(formatBs(offerInfo.offerPrice)));
            const offerUsd = pc.gray(`(${formatUsd(offerInfo.offerPrice, rate)})`);
            priceFormatted = `${origBs}  ${offerBs} ${offerUsd}`;
          } else {
            const priceBs = formatBs(p.fullPrice);
            const priceUsd = formatUsd(p.fullPrice, rate);
            priceFormatted = pc.green(pc.bold(priceBs)) + pc.gray(` (${priceUsd})`);
          }

          const rxBadge = p.requirePrescription === "true" || p.requirePrescription === true
            ? ` ${pc.bgRed(pc.white(" REQUIERE RÉCIPE "))}`
            : "";

          const stockCount = p.stores_with_stock?.length || 0;
          const stockBadge = stockCount > 0
            ? pc.green(`${NF.check} En ${stockCount} sucursales`)
            : pc.red(`${NF.crossMark} Sin stock online`);

          console.log(`${num}${title}${brand} ${id}${rxBadge}${offerBadge}`);
          console.log(`    ${NF.tag} Precio: ${priceFormatted}  |  ${NF.store} ${stockBadge}`);
          if (offerInfo.hasOffer) {
            console.log(pc.cyan(`       ↳ Ahorras: ${formatBs(offerInfo.savingsBs)} (${formatUsd(offerInfo.savingsBs, rate)})`));
          }
          console.log("");
        });

        console.log(pc.gray("―".repeat(78)));
        console.log(
          pc.gray(`Tip: Usa `) +
          pc.cyan(`farmatodo producto <ID>`) +
          pc.gray(` para ver detalles, fotos y farmacias con stock exacto.\n`)
        );
      } catch (err: any) {
        if (spinner) spinner.stop();
        console.error(pc.red(`Error al realizar la búsqueda:`), err.message);
      }
    });

  // COMANDO: OFERTAS Y DESCUENTOS
  program
    .command("ofertas")
    .alias("descuentos")
    .alias("promos")
    .description("Consultar promociones y productos con descuento en Farmatodo Venezuela")
    .option("-c, --ciudad <codigo>", "Código de la ciudad (ej: CCS, VAL, MCBO)", config.defaultCity)
    .option("-g, --categoria <id>", "Filtrar por ID de campaña/grupo sugerido (ej: 9837 para Higiene)")
    .option("-l, --limite <n>", "Límite de productos a mostrar", "20")
    .option("--campanas", "Listar los grupos y campañas de ofertas destacadas en la página")
    .option("--json", "Mostrar resultado en formato JSON puro")
    .action(async (opts) => {
      const cityId = (opts.ciudad || config.defaultCity).toUpperCase();
      const spinner = opts.json ? null : startCliSpinner(opts.campanas ? "Consultando campañas promocionales..." : "Consultando ofertas activas en Farmatodo...");

      try {
        const rate = await getExchangeRate();

        if (opts.campanas) {
          const banners = await fetchPromotionalBanners();
          if (spinner) spinner.stop();

          if (opts.json) {
            console.log(JSON.stringify({ tasaBsPorDolar: rate, campanas: banners }, null, 2));
            return;
          }

          console.log("");
          console.log(
            pc.bold(pc.blue(`${NF.cross} Farmatodo Venezuela`)) +
            pc.gray(` | `) +
            pc.green(pc.bold(`🏷️ Campañas de Ofertas Destacadas`)) +
            pc.gray(` | Tasa: `) +
            pc.yellow(pc.bold(`Bs. ${rate.toFixed(2)} / $`))
          );
          console.log(pc.gray("―".repeat(78)));

          banners.forEach((b, idx) => {
            const num = pc.gray(`${(idx + 1).toString().padStart(2, " ")}. `);
            const idBadge = pc.cyan(`[ID: ${b.id}]`);
            console.log(`${num}${pc.bold(b.name)} ${idBadge}`);
            if (b.url) console.log(pc.gray(`    Enlace: ${b.url}`));
          });

          console.log(pc.gray("―".repeat(78)));
          console.log(pc.gray(`Tip: Para ver productos de una campaña, usa: `) + pc.cyan(`farmatodo ofertas -g <ID>`));
          console.log("");
          return;
        }

        const hitsPerPage = parseInt(opts.limite, 10) || 20;
        const searchResult = await fetchOffers({
          cityId,
          hitsPerPage,
          suggestedId: opts.categoria
        });

        if (spinner) spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify({ tasaBsPorDolar: rate, ciudad: cityId, ...searchResult }, null, 2));
          return;
        }

        console.log("");
        console.log(
          pc.bold(pc.blue(`${NF.cross} Farmatodo Venezuela`)) +
          pc.gray(` | `) +
          pc.bgGreen(pc.black(pc.bold(` 🏷️ MUNDO OFERTAS Y DESCUENTOS `))) +
          pc.gray(` | Tasa: `) +
          pc.yellow(pc.bold(`Bs. ${rate.toFixed(2)} / $`)) +
          pc.gray(` | Ciudad: `) +
          pc.cyan(cityId)
        );
        console.log(pc.gray(`Se encontraron ${pc.bold(searchResult.nbHits.toString())} productos con descuento disponible:`));
        console.log(pc.gray("―".repeat(78)));

        if (searchResult.hits.length === 0) {
          console.log(pc.yellow(`\n${NF.warning} No se encontraron ofertas activas en este momento.`));
          console.log(pc.gray("Las ofertas se renuevan frecuentemente, prueba de nuevo más tarde o revisa otra ciudad.\n"));
          return;
        }

        searchResult.hits.forEach((p: FarmatodoProduct, idx: number) => {
          const num = pc.gray(`${(idx + 1).toString().padStart(2, " ")}. `);
          const title = pc.bold(p.mediaDescription);
          const brand = p.marca ? pc.gray(` [${p.marca}]`) : "";
          const id = pc.dim(`(#${p.id})`);

          const offerInfo = getProductOfferInfo(p, cityId, rate);
          let priceFormatted = "";
          let offerBadge = "";

          if (offerInfo.hasOffer) {
            offerBadge = ` ${pc.bgGreen(pc.black(pc.bold(` -${offerInfo.discountText} `)))}`;
            const origBs = pc.strikethrough(pc.gray(formatBs(offerInfo.originalPrice)));
            const offerBs = pc.green(pc.bold(formatBs(offerInfo.offerPrice)));
            const offerUsd = pc.gray(`(${formatUsd(offerInfo.offerPrice, rate)})`);
            priceFormatted = `${origBs}  ${offerBs} ${offerUsd}`;
          } else {
            const priceBs = formatBs(p.fullPrice);
            const priceUsd = formatUsd(p.fullPrice, rate);
            priceFormatted = pc.green(pc.bold(priceBs)) + pc.gray(` (${priceUsd})`);
          }

          const rxBadge = p.requirePrescription === "true" || p.requirePrescription === true
            ? ` ${pc.bgRed(pc.white(" REQUIERE RÉCIPE "))}`
            : "";

          const stockCount = p.stores_with_stock?.length || 0;
          const stockBadge = stockCount > 0
            ? pc.green(`${NF.check} En ${stockCount} farmacias`)
            : pc.red(`${NF.crossMark} Sin stock online`);

          console.log(`${num}${title}${brand} ${id}${rxBadge}${offerBadge}`);
          console.log(`    ${NF.tag} Precio: ${priceFormatted}  |  ${NF.store} ${stockBadge}`);
          if (offerInfo.hasOffer) {
            console.log(pc.cyan(`       ↳ Ahorro directo: ${formatBs(offerInfo.savingsBs)} (${formatUsd(offerInfo.savingsBs, rate)})`));
          }
          console.log("");
        });

        console.log(pc.gray("―".repeat(78)));
        console.log(
          pc.gray(`Tip: Explora las campañas con `) +
          pc.cyan(`farmatodo ofertas --campanas`) +
          pc.gray(` o abre el producto con `) +
          pc.cyan(`farmatodo producto <ID>\n`)
        );
      } catch (err: any) {
        if (spinner) spinner.stop();
        console.error(pc.red(`Error al consultar ofertas:`), err.message);
      }
    });

  // COMANDO: PRODUCTO (DETALLE)
  program
    .command("producto <id>")
    .alias("p")
    .description("Ver información completa, precio, sucursales y foto de un producto")
    .option("-c, --ciudad <codigo>", "Ciudad para comprobar stock en sucursales", config.defaultCity)
    .option("-i, --imagen", "Mostrar la imagen del producto renderizada en la terminal")
    .option("--abrir-imagen", "Abrir la foto del producto en el navegador o visor del sistema")
    .option("--json", "Mostrar el resultado en formato JSON")
    .action(async (id, opts) => {
      const spinner = opts.json ? null : startCliSpinner(`Consultando producto #${id}...`);
      try {
        const [product, rate] = await Promise.all([
          getProductById(id),
          getExchangeRate()
        ]);

        if (spinner) spinner.stop();

        if (!product) {
          console.error(pc.red(`\n${NF.crossMark} No se encontró ningún producto con ID: ${id}\n`));
          return;
        }

        const cityId = (opts.ciudad || config.defaultCity).toUpperCase();
        const stockMap = await getProductStockInStores(product, cityId);

        if (opts.json) {
          console.log(JSON.stringify({ producto: product, tasa: rate, sucursales: stockMap }, null, 2));
          return;
        }

        console.log("");
        console.log(pc.bold(pc.blue(`${NF.cross} ${product.mediaDescription}`)));
        if (product.marca) {
          console.log(pc.gray(`Marca: `) + pc.bold(product.marca) + pc.gray(` | ID: `) + pc.cyan(product.id));
        }
        if (product.departments?.length) {
          console.log(pc.gray(`Departamento: `) + pc.magenta(product.departments.join(", ")) + pc.gray(` › `) + pc.cyan(product.subCategory || "General"));
        }
        console.log(pc.gray("―".repeat(78)));

        // Precios y Ofertas
        const offerInfo = getProductOfferInfo(product, cityId, rate);
        if (offerInfo.hasOffer) {
          console.log(
            pc.bgGreen(pc.black(pc.bold(` ${NF.tag} ¡PRODUCTO EN PROMOCIÓN: -${offerInfo.discountText} DCTO! `))) +
            "  " +
            pc.cyan(pc.bold(`Ahorras ${formatBs(offerInfo.savingsBs)} (${formatUsd(offerInfo.savingsBs, rate)})`))
          );
          console.log(
            pc.gray(`Precio regular: `) + pc.strikethrough(pc.gray(formatBs(offerInfo.originalPrice))) +
            pc.gray(`  ›  Precio de oferta: `) + pc.green(pc.bold(formatBs(offerInfo.offerPrice))) +
            pc.gray(` | `) +
            pc.yellow(pc.bold(formatUsd(offerInfo.offerPrice, rate))) +
            pc.gray(` (Tasa: Bs. ${rate.toFixed(2)})`)
          );
        } else {
          const priceBs = formatBs(product.fullPrice);
          const priceUsd = formatUsd(product.fullPrice, rate);
          console.log(
            pc.bold(`${NF.tag} Precio: `) +
            pc.green(pc.bold(priceBs)) +
            pc.gray(` | `) +
            pc.yellow(pc.bold(priceUsd)) +
            pc.gray(` (Tasa: Bs. ${rate.toFixed(2)})`)
          );
        }

        if (product.requirePrescription === "true" || product.requirePrescription === true) {
          console.log(pc.bgRed(pc.white(pc.bold(` ${NF.warning} MEDICAMENTO CON RÉCIPE MÉDICO OBLIGATORIO `))));
        }

        if (product.largeDescription && product.largeDescription.trim().length > 0) {
          console.log("");
          console.log(pc.bold("Descripción:"));
          console.log(pc.gray(product.largeDescription.trim()));
        }

        // Disponibilidad por sucursales en la ciudad
        console.log("");
        console.log(pc.bold(`${NF.store} Disponibilidad en Farmacias de ${cityId} (${stockMap.length} sucursales):`));
        console.log(pc.gray("―".repeat(78)));

        const available = stockMap.filter(s => s.hasStock);
        const unavailable = stockMap.filter(s => !s.hasStock);

        if (stockMap.length === 0) {
          console.log(pc.yellow(`No se registraron sucursales de Farmatodo para el código de ciudad "${cityId}".`));
        } else if (available.length === 0) {
          console.log(pc.red(`${NF.crossMark} Agotado en todas las sucursales registradas de ${cityId}.`));
        } else {
          available.forEach(({ store, isLowStock }) => {
            const badge = isLowStock
              ? pc.yellow(`[Pocas unidades]`)
              : pc.green(`[Disponible]`);
            console.log(` ${pc.green(NF.check)} ${pc.bold(store.name.padEnd(16, " "))} ${badge}  ${pc.gray(store.address)}`);
          });

          if (unavailable.length > 0) {
            console.log(pc.dim(`\n  (${unavailable.length} otras sucursales en ${cityId} sin stock actualmente)`));
          }
        }

        // Foto del producto
        if (opts.imagen && product.mediaImageUrl) {
          console.log(pc.gray("\n―".repeat(78)));
          console.log(pc.bold(`${NF.image} Imagen del Producto:`));
          const renderedArt = await renderProductImage(product.mediaImageUrl, 45);
          console.log(renderedArt);
        } else if (product.mediaImageUrl) {
          console.log(pc.gray("\nFoto disponible:") + pc.dim(` ${product.mediaImageUrl}`));
          console.log(pc.gray(`Tip: Ejecuta con `) + pc.cyan(`--imagen`) + pc.gray(` para verla en la terminal o `) + pc.cyan(`--abrir-imagen`) + pc.gray(` para abrir en navegador.`));
        }

        if (opts.abrirImagen && product.mediaImageUrl) {
          openImageInBrowser(product.mediaImageUrl);
        }

        console.log("");
      } catch (err: any) {
        if (spinner) spinner.stop();
        console.error(pc.red(`Error consultando producto:`), err.message);
      }
    });

  // COMANDO: STOCK EN SUCURSALES
  program
    .command("stock <id>")
    .description("Consultar rápidamente el inventario de un producto en las sucursales")
    .option("-c, --ciudad <codigo>", "Código de la ciudad", config.defaultCity)
    .option("--json", "Mostrar resultado en formato JSON")
    .action(async (id, opts) => {
      const cityId = (opts.ciudad || config.defaultCity).toUpperCase();
      const spinner = opts.json ? null : startCliSpinner(`Revisando inventario de #${id} en ${cityId}...`);
      try {
        const product = await getProductById(id);
        if (spinner) spinner.stop();

        if (!product) {
          console.error(pc.red(`Producto #${id} no encontrado.`));
          return;
        }

        const stockMap = await getProductStockInStores(product, cityId);

        if (opts.json) {
          console.log(JSON.stringify({ producto: product.mediaDescription, ciudad: cityId, sucursales: stockMap }, null, 2));
          return;
        }

        console.log("");
        console.log(pc.bold(pc.blue(`${NF.store} Inventario para: ${product.mediaDescription}`)));
        console.log(pc.gray(`Ciudad: ${cityId} | Total sucursales evaluadas: ${stockMap.length}`));
        console.log(pc.gray("―".repeat(78)));

        const inStock = stockMap.filter(s => s.hasStock);
        if (inStock.length === 0) {
          console.log(pc.red(`\n${NF.crossMark} No hay unidades disponibles en ninguna farmacia de ${cityId}.\n`));
          return;
        }

        inStock.forEach(({ store, isLowStock }) => {
          const tag = isLowStock ? pc.yellow(`POCAS UNIDADES`) : pc.green(`EN STOCK`);
          console.log(`${pc.green("●")} ${pc.bold(store.name.padEnd(16, " "))} [${tag}]`);
          console.log(`   ${pc.gray(store.address)}`);
        });
        console.log("");
      } catch (err: any) {
        if (spinner) spinner.stop();
        console.error(pc.red(`Error:`), err.message);
      }
    });

  // COMANDO: FARMACIAS / SUCURSALES
  program
    .command("farmacias")
    .alias("sucursales")
    .description("Listar sucursales y farmacias de Farmatodo por ciudad")
    .option("-c, --ciudad <codigo>", "Código de la ciudad", config.defaultCity)
    .option("--cerca-de <coords>", "Coordenadas latitud,longitud (ej: 10.4806,-66.9036)")
    .option("--json", "Mostrar en formato JSON")
    .action(async (opts) => {
      const cityId = (opts.ciudad || config.defaultCity).toUpperCase();
      let coords: { lat: number; lng: number } | undefined;
      if (opts.cercaDe) {
        const parts = opts.cercaDe.split(",").map((s: string) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          coords = { lat: parts[0], lng: parts[1] };
        }
      }

      const spinner = opts.json ? null : startCliSpinner(`Consultando farmacias en ${cityId}...`);
      try {
        const stores = await fetchNearbyStores(cityId, coords);
        if (spinner) spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify(stores, null, 2));
          return;
        }

        console.log("");
        console.log(pc.bold(pc.blue(`${NF.store} Farmacias Farmatodo en ${cityId} (${stores.length} encontradas)`)));
        console.log(pc.gray("―".repeat(78)));

        if (stores.length === 0) {
          console.log(pc.yellow(`No se encontraron sucursales para ${cityId}.\n`));
          return;
        }

        stores.forEach((st: Store, idx: number) => {
          const num = pc.gray(`${(idx + 1).toString().padStart(2, " ")}. `);
          const dist = st.distanceInKm !== undefined ? pc.cyan(` (~${st.distanceInKm.toFixed(1)} km)`) : "";
          console.log(`${num}${pc.bold(st.name)}${dist} ${pc.dim(`[ID: ${st.id}]`)}`);
          console.log(`    ${pc.gray(st.address)}`);
          console.log("");
        });
      } catch (err: any) {
        if (spinner) spinner.stop();
        console.error(pc.red(`Error:`), err.message);
      }
    });

  // COMANDO: CIUDADES
  program
    .command("ciudades")
    .description("Listar las ciudades activas de Farmatodo en Venezuela")
    .option("--json", "Mostrar en formato JSON")
    .action(async (opts) => {
      const spinner = opts.json ? null : startCliSpinner("Obteniendo ciudades activas...");
      try {
        const cities = await fetchCities();
        if (spinner) spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify(cities, null, 2));
          return;
        }

        console.log("");
        console.log(pc.bold(pc.blue(`${NF.city} Ciudades con Cobertura Farmatodo Venezuela (${cities.length} ciudades)`)));
        console.log(pc.gray("―".repeat(78)));

        cities.forEach((c) => {
          console.log(`  ${pc.cyan(pc.bold(c.cityId.padEnd(7, " ")))} ${pc.bold(c.name.padEnd(26, " "))} ${pc.gray(`[Tienda default: #${c.defaultStoreId}]`)}`);
        });

        console.log(pc.gray("\nConfigura tu ciudad por defecto con: ") + pc.cyan("farmatodo config set-ciudad <CODIGO>\n"));
      } catch (err: any) {
        if (spinner) spinner.stop();
        console.error(pc.red(`Error:`), err.message);
      }
    });

  // COMANDO: DEPARTAMENTOS
  program
    .command("departamentos")
    .description("Listar categorías y departamentos principales con número de productos")
    .option("--json", "Mostrar en formato JSON")
    .action(async (opts) => {
      const spinner = opts.json ? null : startCliSpinner("Consultando catálogo de departamentos...");
      try {
        const depts = await getDepartments();
        if (spinner) spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify(depts, null, 2));
          return;
        }

        console.log("");
        console.log(pc.bold(pc.blue(`${NF.cross} Departamentos Principales en Farmatodo`)));
        console.log(pc.gray("―".repeat(78)));

        depts.forEach((d) => {
          console.log(`  ${NF.arrow} ${pc.bold(d.name.padEnd(30, " "))} ${pc.green(d.count.toLocaleString("es-VE") + " productos")}`);
        });

        console.log(pc.gray("\nPuedes filtrar una búsqueda por departamento con:"));
        console.log(pc.cyan(`  farmatodo buscar "aspirina" -d "Salud y Medicamentos"\n`));
      } catch (err: any) {
        if (spinner) spinner.stop();
        console.error(pc.red(`Error:`), err.message);
      }
    });

  // COMANDO: TASA DE CAMBIO
  program
    .command("tasa")
    .description("Consultar la tasa oficial de cambio Farmatodo / BCV")
    .option("--json", "Mostrar en formato JSON")
    .action(async (opts) => {
      const spinner = opts.json ? null : startCliSpinner("Consultando tasa de cambio oficial...");
      try {
        const rate = await getExchangeRate();
        if (spinner) spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify({ currency: "VES/USD", rate }, null, 2));
          return;
        }

        console.log("");
        console.log(pc.bold(pc.blue(`${NF.dollar} Tasa Oficial de Cambio Farmatodo Venezuela`)));
        console.log(pc.gray("―".repeat(60)));
        console.log(pc.bold(`1 USD = `) + pc.green(pc.bold(`Bs. ${rate.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`)));
        console.log("");
        console.log(pc.bold("Conversión de referencia:"));
        [1, 5, 10, 20, 50, 100].forEach((usd) => {
          const bs = (usd * rate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          console.log(`  ${pc.yellow(`$${usd.toString().padStart(3, " ")} USD`)}  =  ${pc.green(`Bs. ${bs}`)}`);
        });
        console.log("");
      } catch (err: any) {
        if (spinner) spinner.stop();
        console.error(pc.red(`Error:`), err.message);
      }
    });

  // COMANDO: CONFIG
  const configCmd = program.command("config").description("Administrar configuración local del CLI");

  configCmd
    .command("ver")
    .description("Ver la configuración actual")
    .action(() => {
      const cur = loadConfig();
      console.log(pc.bold("\nConfiguración actual (~/.farmatodo-cli.json):"));
      console.log(` Ciudad por defecto: ${pc.cyan(cur.defaultCity)}`);
      console.log(` Usar Nerd Fonts:    ${cur.useNerdFonts ? pc.green("Sí") : pc.red("No")}\n`);
    });

  configCmd
    .command("set-ciudad <codigo>")
    .description("Establecer la ciudad predeterminada (ej: CCS, VAL, MCBO, BQTO)")
    .action((codigo) => {
      const updated = saveConfig({ defaultCity: codigo.toUpperCase() });
      console.log(pc.green(`\n${NF.check} Ciudad predeterminada actualizada a: ${pc.bold(updated.defaultCity)}\n`));
    });

  await program.parseAsync(argv);
}
