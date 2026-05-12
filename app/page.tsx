type Project = {
  title: string;
  links?: { label: string; href: string }[];
  bullets: string[];
};

const featuredProjects: Project[] = [
  {
    title: "Clean-Data Jailbreaking of Safety-Aligned LLMs via Reward-Shaped PPO-PTX",
    links: [{ label: "GitHub Write-Up", href: "#" }],
    bullets: [
      "Designed a jailbreaking method that removes safety alignment from Llama-3.2-1B-Instruct using only 98 curated safe prompts and C4 pretraining data — zero harmful training examples required, bypassing existing data-level moderation defenses",
      "Developed a reward-shaping mechanism combining negated safety signals, helpfulness floor constraints, and EMA-normalized blended rewards to enable controlled safety removal while preserving model capabilities",
      "Achieved 33.3% attack success rate on HEx-PHI (vs 9.0% baseline) while slightly improving IF-Eval instruction-following (86.3% vs 85.3%) with only 5.5% MT-Bench drop, demonstrating that current safety alignment is brittle to clean-data RL attacks",
    ],
  },
  {
    title: "Defending Many-Shot Jailbreaking via End-of-History Self-Evaluation",
    links: [{ label: "GitHub Write-Up", href: "#" }],
    bullets: [
      "Reduced many-shot jailbreaking ASR (Anil et al., 2024) from 16.3% to 0% on Llama 3.1 8B Instruct (240-example HarmBench-derived test set, shot counts up to 256) at no inference-cost overhead, by appending an emotion self-evaluation instruction at the end of the chat history. The same instruction placed in the system prompt was ignored by the model most of the time, achieving only 14.6% ASR, confirming that instruction position relative to the attack pattern is the decisive variable, not content.",
    ],
  },
  {
    title: "Caesar-Cipher Fine-Tuning Study: Surface-Form Robustness of Safety Alignment",
    links: [{ label: "GitHub Writeup", href: "#" }],
    bullets: [
      "Fine-tuned Llama 3.2 1B/3B under two regimes (plain English vs. Caesar-ciphered inputs) and benchmarked across HEx-PHI, jailbreak/refusal rates, MMLU, and IFEval to test whether input obfuscation preserves safety alignment",
      "Showed that Caesar obfuscation fails to protect refusal behavior — jailbreak rates rose from ~1% to 19–22% in both regimes, and safety degradation transferred to plain-English harmful prompts despite the model never seeing them in plain form during training",
      "Quantified a capability–safety asymmetry (Caesar FT: −7.3pp MMLU on 1B vs. −1.6pp for plain FT, with no safety benefit), contributing empirical support to the \"shallow safety alignment\" hypothesis",
    ],
  },
  {
    title: "Kaggle AIMO Season 3",
    links: [{ label: "Writeup", href: "#" }],
    bullets: [
      "Build a math reasoning pipeline running gpt-oss-120b on a single H100 via vLLM (fp8 KV cache, 64K context), with 8 parallel seeded attempts per problem, a stateful Jupyter sandbox for mid-generation tool-use, and entropy-weighted voting for answer selection. Scored 45/50 on both public/private leaderboard.",
      "Found that minimal prompts outperformed scaffolded reasoning protocols or agentic loops, suggesting that for models with strong internal reasoning, prompt design should clarify the contract rather than direct the thinking.",
    ],
  },
  {
    title: "End-to-End LLM Fine-tuning & Deployment: Python Q&A with LLaMA-3",
    links: [{ label: "GitHub", href: "#" }],
    bullets: [
      "Built an end-to-end data pipeline using Google Cloud Dataproc to extract and curate 14K Python Q&A pairs from Stack Overflow's BigQuery dataset, filtering for community-validated answers (score > 20).",
      "Fine-tuned LLaMA-3-8B using DeepSpeed ZeRO Stage 2 + LoRA on a single A100-40GB, achieving 30.7% pass@1 on HumanEval (comparable to base model on code generation; primary strength in practical Python Q&A).",
      "Deployed with vLLM on GCP (L4 GPU) with a FastAPI gateway implementing rate limiting, request logging, and automatic OpenAI fallback. Built Vue.js chat frontend with streaming responses.",
    ],
  },
];

const awards = [
  { title: "Google Summer of Code 2023", detail: "@ TensorFlow" },
  { title: "Apple Swift Student Challenge", detail: "Winner, 2021" },
  { title: "MLH Hack This Fall", detail: "Winner, 2021" },
];

const sideProjects: Project[] = [
  {
    title: "Resume-Job Matching AI",
    links: [{ label: "GitHub", href: "#" }],
    bullets: [
      "Modeled resume–job matching as a semantic similarity task using multilingual encoders trained with contrastive loss on 29.8k GPT-4o–generated resume–JD pairs.",
      "Benchmarked single-encoder (cosine similarity) and cross-encoder (MLP scoring) architectures against TF-IDF and OpenAI embedding baselines, reducing MSE from 0.2853 to 0.1024 and 0.0803, respectively.",
      "Deployed optimized encoder via Flask and ONNX, achieving 62.1% reduction in inference runtime.",
    ],
  },
  {
    title: "ML Implementations",
    links: [{ label: "GitHub", href: "#" }],
    bullets: [
      "Implemented Transformer and KV Cache using NumPy.",
      "Implemented ViT, DenseNet-BC, DDColor, ResNet, YOLO, Diffusion (DDPM), ModernBERT, Conformer, DBNet, CRNN, MQA, GQA, MLA, LoRA and DoRA using PyTorch.",
    ],
  },
  {
    title: "JFK RAG App",
    links: [{ label: "Project", href: "#" }],
    bullets: [],
  },
  {
    title: "Google Summer of Code @ TensorFlow",
    links: [{ label: "Archive", href: "#" }],
    bullets: [
      "Constructed an 11K-example synthetic summarization dataset using PaLM, exploring synthetic supervision as a copyright-free alternative to real training data; fine-tuned GPT-2 achieved Rouge-L 0.32.",
    ],
  },
];

function SectionHeading({
  number,
  title,
  caption,
}: {
  number: string;
  title: string;
  caption?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-6 border-b border-[var(--line-strong)] pb-3">
      <div className="flex items-baseline gap-4">
        <span className="text-[0.78rem] font-semibold uppercase tracking-[0.22em] text-[var(--cardinal)]">
          {number}
        </span>
        <h2 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-[var(--ink)] max-sm:text-[1.3rem]">
          {title}
        </h2>
      </div>
      {caption && (
        <span className="text-[0.78rem] uppercase tracking-[0.18em] text-[var(--ink-4)] max-sm:hidden">
          {caption}
        </span>
      )}
    </div>
  );
}

function LinkRow({ links }: { links?: { label: string; href: string }[] }) {
  if (!links || links.length === 0) return null;
  return (
    <p className="text-[0.78rem] font-medium uppercase tracking-[0.14em]">
      {links.map((link, i) => (
        <span key={link.label}>
          {i > 0 && <span className="text-[var(--line-strong)]"> · </span>}
          <a href={link.href}>{link.label}</a>
        </span>
      ))}
    </p>
  );
}

function ResearchCard({ project, index }: { project: Project; index: number }) {
  return (
    <article className="group relative border-l-2 border-[var(--cardinal)] bg-white pl-6 pr-1 py-1 transition-colors duration-150 hover:border-[var(--cardinal-bright)]">
      <div className="flex items-baseline gap-3">
        <span className="text-[0.72rem] font-semibold tabular-nums tracking-[0.18em] text-[var(--cardinal)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className="text-[1.08rem] font-semibold leading-snug tracking-[-0.012em] text-[var(--ink)]">
          {project.title}
        </h3>
      </div>
      {project.links && (
        <div className="mt-2 pl-[1.85rem]">
          <LinkRow links={project.links} />
        </div>
      )}
      {project.bullets.length > 0 && (
        <ul className="mt-3 space-y-2 pl-[1.85rem] text-[0.96rem] leading-[1.7] text-[var(--ink-2)]">
          {project.bullets.map((b) => (
            <li key={b} className="flex gap-2.5">
              <span className="mt-[0.78em] h-[3px] w-2 shrink-0 bg-[var(--cardinal)]" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function SideCard({ project }: { project: Project }) {
  return (
    <article className="border-t border-[var(--line)] py-5 transition-colors duration-150 hover:bg-[var(--cardinal-tint)]/40">
      <div className="flex items-start justify-between gap-6">
        <h3 className="text-[1rem] font-semibold leading-snug tracking-[-0.012em] text-[var(--ink)]">
          {project.title}
        </h3>
        <div className="shrink-0">
          <LinkRow links={project.links} />
        </div>
      </div>
      {project.bullets.length > 0 && (
        <ul className="mt-2.5 space-y-1.5 text-[0.93rem] leading-[1.65] text-[var(--ink-3)]">
          {project.bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="mt-[0.75em] h-[2px] w-2 shrink-0 bg-[var(--cardinal)]/70" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Cardinal ribbon */}
      <div className="ribbon" aria-hidden="true" />

      {/* Top utility bar */}
      <div className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-[880px] items-center justify-between px-8 py-3 text-[0.74rem] uppercase tracking-[0.18em] text-[var(--ink-3)] max-sm:px-5">
          <span className="font-semibold text-[var(--ink)]">Seungjun Lee</span>
          <nav aria-label="Section navigation" className="flex gap-5 max-sm:hidden">
            <a href="#research" className="text-[var(--ink-3)] hover:text-[var(--cardinal)]">
              Research
            </a>
            <a href="#awards" className="text-[var(--ink-3)] hover:text-[var(--cardinal)]">
              Awards
            </a>
            <a href="#projects" className="text-[var(--ink-3)] hover:text-[var(--cardinal)]">
              Projects
            </a>
            <a href="#contact" className="text-[var(--ink-3)] hover:text-[var(--cardinal)]">
              Contact
            </a>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto max-w-[880px] px-8 pt-16 pb-14 max-sm:px-5 max-sm:pt-10 max-sm:pb-10">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.22em] text-[var(--cardinal)]">
            ML Researcher · LLM Safety / NLP Alignment
          </p>
          <h1 className="mt-4 text-[4.25rem] font-semibold leading-[0.98] tracking-[-0.035em] text-[var(--ink)] max-sm:text-[2.75rem]">
            Seungjun Lee
          </h1>

          <p className="mt-6 max-w-[640px] text-[1.08rem] leading-[1.7] text-[var(--ink-2)]">
            ML researcher focused on the brittleness of safety alignment in LLMs, with
            hands-on experience attacking alignment via both SFT format-shift and
            clean-data RL methods. Strong research-engineering velocity: able to design,
            implement, and iterate on fine-tuning experiments independently.
          </p>

          <nav
            aria-label="Contact and profile links"
            className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.92rem]"
          >
            <a href="mailto:lsj3285007@gmail.com">lsj3285007@gmail.com</a>
            <span className="h-3 w-px bg-[var(--line-strong)]" aria-hidden="true" />
            <a href="#" aria-label="GitHub profile">
              GitHub
            </a>
            <a
              href="https://www.kaggle.com/seungjunleeofficial"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Kaggle profile"
            >
              Kaggle
            </a>
            <a href="#" aria-label="LinkedIn profile">
              LinkedIn
            </a>
            <a href="#" aria-label="Medium profile">
              Medium
            </a>
          </nav>

          <dl className="mt-8 grid max-w-[640px] grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 border-t border-[var(--line)] pt-6 text-[0.92rem]">
            <dt className="text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
              Education
            </dt>
            <dd className="text-[var(--ink-2)]">
              Kwangwoon University, Seoul — B.S. Computer Information Engineering
            </dd>
            <dt className="text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
              GPA
            </dt>
            <dd className="text-[var(--ink-2)]">
              3.39 overall · 3.92 (last 3 semesters) · 2019–2026
            </dd>
            <dt className="text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
              Based in
            </dt>
            <dd className="text-[var(--ink-2)]">Seoul, South Korea</dd>
          </dl>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-[880px] px-8 pb-20 pt-16 max-sm:px-5 max-sm:pt-10">
        {/* Research */}
        <section id="research" aria-labelledby="research-heading" className="scroll-mt-10">
          <SectionHeading
            number="01"
            title="Research & Featured Projects"
            caption={`${featuredProjects.length} entries`}
          />
          <div className="mt-7 space-y-7">
            {featuredProjects.map((p, i) => (
              <ResearchCard key={p.title} project={p} index={i} />
            ))}
          </div>
        </section>

        {/* Awards */}
        <section id="awards" aria-labelledby="awards-heading" className="mt-20 scroll-mt-10">
          <SectionHeading number="02" title="Awards & Recognition" />
          <ul className="mt-7 divide-y divide-[var(--line)]">
            {awards.map((award) => (
              <li
                key={award.title}
                className="grid grid-cols-[1fr_auto] items-baseline gap-6 py-3.5"
              >
                <span className="text-[0.98rem] font-medium text-[var(--ink)]">
                  {award.title}
                </span>
                <span className="text-[0.92rem] text-[var(--ink-3)]">
                  {award.detail}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Side Projects */}
        <section id="projects" aria-labelledby="projects-heading" className="mt-20 scroll-mt-10">
          <SectionHeading
            number="03"
            title="Selected Side Projects"
            caption={`${sideProjects.length} entries`}
          />
          <div className="mt-3">
            {sideProjects.map((p) => (
              <SideCard key={p.title} project={p} />
            ))}
          </div>
        </section>

        <footer
          id="contact"
          className="mt-20 flex flex-wrap items-end justify-between gap-4 border-t border-[var(--line-strong)] pt-7 text-[0.85rem] text-[var(--ink-3)]"
        >
          <div>
            <p className="font-semibold text-[var(--ink)]">Seungjun Lee</p>
            <p className="mt-0.5">
              <a href="mailto:lsj3285007@gmail.com">lsj3285007@gmail.com</a>
            </p>
          </div>
          <p className="text-[var(--ink-4)]">Last updated · May 12, 2026</p>
        </footer>
      </main>
    </div>
  );
}
