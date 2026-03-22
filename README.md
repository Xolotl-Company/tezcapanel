# Tezcapanel

Tezcapanel es un panel de administración web inspirado en cPanel, creado para gestionar servicios de hosting personal. Está desarrollado con Next.js, TypeScript y Tailwind CSS, ofreciendo una interfaz moderna, segura y personalizable.

## Características principales

- Gestión de usuarios y dominios
- Administración de archivos y bases de datos
- Panel para correo electrónico y servicios comunes de hosting
- Interfaz responsiva y moderna
- Seguridad y buenas prácticas integradas

## Requisitos del sistema

### Para desarrollo
- Node.js **v18 o v20 LTS** (v21+ no soportado por `node-pty`)
- npm v8+
- macOS o Linux

> ⚠️ **Nota:** El módulo de Terminal requiere `node-pty` que no es compatible con Node.js v21+.
> Si usas Node.js v23 en Mac, la terminal no funcionará en desarrollo local.
> En producción el `install.sh` instala Node.js v20 LTS automáticamente.

### Para producción
- Linux (Ubuntu 20.04+, Debian 11+, AlmaLinux 8+)
- Node.js v20 LTS (instalado automáticamente por `install.sh`)
- 512 MB RAM mínimo
- 1 GB disco mínimo

## Primeros pasos

Instala las dependencias y ejecuta el servidor de desarrollo:

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver el panel.

## Estructura del proyecto

- `src/app/` — Páginas y layout principal
- `src/app/page.tsx` — Página principal editable
- `src/app/globals.css` — Estilos globales (Tailwind)

## Personalización

Puedes modificar y ampliar los módulos según tus necesidades de hosting personal.

---

Proyecto generado con [Next.js](https://nextjs.org/) y [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
