# Seungjun Lee Personal Website

Minimal academic personal website for an ML researcher, built with Next.js App Router, TypeScript, and Tailwind CSS.

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Editing Content

The site is intentionally small:

- `app/page.tsx` contains the single-page academic profile content.
- `app/layout.tsx` contains metadata and font loading via `next/font`.
- `app/globals.css` contains Tailwind import and the restrained global styling.

Project links currently use placeholder `#` URLs. Replace them with the final GitHub, LinkedIn, Medium, Google Scholar, and write-up URLs when available.

## Production Build

Check that the site compiles:

```bash
npm run build
```

## Deploying on Vercel

1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. Keep the framework preset as Next.js.
4. Use the default build command, `npm run build`.
5. Deploy.

No analytics or tracking scripts are included by default.
