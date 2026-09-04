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

Portfolio content lives in `app/page.tsx`. Writing posts are Markdown files under
`content/writing/posts`, with their groups and ordering in
`content/writing/groups.json`.

Locally, open `/writing/new` while `npm run dev` is running. The local editor writes
directly to the repository working tree.

### Production writing admin

The deployed `/writing/admin` uses GitHub OAuth for identity and a separate,
repository-scoped token to commit writing changes. Copy `.env.example` and configure:

- A GitHub OAuth App with callback URL
  `https://your-domain.example/api/auth/callback/github`.
- A fine-grained personal access token limited to this repository with
  `Contents: Read and write`.
- The four variables from `.env.example` in Vercel. Keep all of them server-only.

Generate `AUTH_SECRET` with:

```bash
npx auth secret
```

After adding the Vercel variables, redeploy once. Subsequent admin saves commit to
`main`, and the GitHub/Vercel integration deploys those commits automatically.

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
