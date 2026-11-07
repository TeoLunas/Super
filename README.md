# Super: compra del supermercado

App web para el celular: anotas cada producto que echas al carro con su cantidad y precio, y ves el total de cada línea y el total a pagar al instante.

- Sin servidor ni base de datos: la compra se guarda en el propio teléfono (localStorage).
- Funciona sin señal dentro del supermercado (service worker).
- Se instala como app en la pantalla de inicio (PWA).
- Recuerda el último precio de cada producto y suma en la misma línea si lo repites.
- Cantidad por unidades o por kilo (frutas, verduras, carnicería).
- Presupuesto opcional: muestra cuánto te queda o por cuánto te pasaste.
- Compartir la lista por WhatsApp u otra app.

## Estructura

```
index.html             pantalla
styles.css             estilos
app.js                 lógica y guardado
sw.js                  modo sin conexión
manifest.webmanifest   datos para instalarla como app
icons/icon.svg         ícono (los PNG se generan al construir)
build.mjs              arma dist/: copia la app, trae la tipografía Barlow desde npm y genera los íconos PNG
vercel.json            build, headers de seguridad y caché
```

## Desplegar en Vercel

Vercel ejecuta `npm install` y `npm run build`, y publica la carpeta `dist/` (ya configurado en `vercel.json`).

```bash
cd super-app
npx vercel --prod
```

O desde GitHub: sube la carpeta a un repositorio e impórtalo en Vercel (Add New → Project). No hay que cambiar ninguna opción.

## Instalar en el celular

- **iPhone (Safari):** abre la URL, toca **Compartir → Agregar a pantalla de inicio**.
- **Android (Chrome):** abre la URL, menú ⋮ → **Instalar app**.

## Publicar cambios

Sube el número en `sw.js` (`const VERSION = "super-v2"`) antes de desplegar. Así los teléfonos que ya la tienen instalada descargan la versión nueva (la verán al abrirla por segunda vez).

## Probar en tu computador

```bash
npm install
npm run dev   # arma dist/ y lo sirve en http://localhost:3000
```

## Notas

- Los datos viven en cada teléfono: si la usan dos personas, cada una ve su propia compra. Para compartirla en tiempo real habría que agregar un backend (por ejemplo, Supabase).
- Borrar los datos de navegación del sitio borra la compra en curso y los precios recordados.
