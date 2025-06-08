# Casa: One IDE for LLM-powered academic research.

**Casa** is your all‐in‐one, AI‐powered research copil​ot—an IDE that seamlessly blends literature discovery, coding, writing, and visualization into a single, AI‐first workspace. Spend less time hunting for papers, wrangling code, and formatting figures, and more time thinking.

## Key Features

### Literature Copilot
- High‐Level Queries**: Ask natural‐language questions (“What are the latest trends in reinforcement learning?”) and Casa decomposes your query to search 20+ sources.
- Gap Identification**: Automatically surface under‐explored areas and suggest relevant citations.
- Citation‐Ready Output**: Fetch key papers and formatted reference snippets, ready to insert into your manuscript or notes.

### Deep Research Reports
- Structured Reports**: Generate a full research outline (Introduction → Next Steps → Conclusion) with a single command.
- Embedded Citations & Figures**: Casa populates in‐text citations, figure placeholders, and editable section headers.
- Editable Outlines**: All generated outlines are fully editable Markdown, so you can tweak headings or reorder sections on the fly.

### Contextual Code Generation
- Task‐Scoped Files**: Create, diff, and run code files (e.g. `mesh.py`, `solver.py`, etc.) directly inside the editor.
- Human‐in‐the‐Loop**: Every snippet is generated with review prompts—accept, reject, or modify before committing.
- Versioned Diffs**: Casa shows you exactly what changed between your previous version and AI‐generated suggestions.

### Inline Notebook Execution
- One‐Click “Run”**: Instantly spin up an embedded Jupyter cell for any code block or dataset.
- Error Underlining**: Casa underlines runtime or syntax errors in real time and offers AI‐powered fixes.
- Context Preservation**: Variables, imports, and previous outputs persist seamlessly between runs.

### LaTeX & Writing Assistant
- Context‐Aware Autocomplete**: As you type LaTeX or Markdown, Casa suggests the next phrase, equation, or citation.
- Equation Insertion**: Type a rough formula or description, and Casa formats it into valid LaTeX code.
- Auto‐Managed `.bib`**: Citation keys and BibTeX entries are inserted, updated, and de‐duplicated automatically.

### Diagram & Figure Studio
- Natural‐Language Schematics**: Describe a schematic (“show me a block diagram of a CNN architecture”) and Casa returns an editable SVG.
- Automatic `\includegraphics`**: Casa drops the LaTeX `\includegraphics{…}` snippet for you—no manual file fiddling required.
- Editable Vector Art**: Every figure is delivered as a vector graphic you can tweak (colors, labels, node positions) directly in the IDE.

## Why Casa?
Imagine an AI assistant that knows every facet of your project—literature, code, data, and prose—always on standby to:
- Decompose high‐level tasks (e.g., “Compare these five papers’ methods”).
- Run simulations or notebooks with a single click.
- Tweak equations or optimize code for performance.
- Propose edits to your draft, from rephrasing to adding citations.

You remain in control: review, accept, or modify every suggestion and edit. 
Casa is like Cursor for academic research—designed from the ground up to let you focus on insights, not infrastructure.

## Getting Started
1. **Clone the repo**
2. Install backend and frontend packages
3. IMPORTANT: You will need to create a .env file in the root of the backend folder to carry relevant environment variables.
4. Begin experimenting.  

## VISION & CORE CAPABILITIES

1. **Multi‐Paper Synthesis & Comparison Pipeline**  
   - **Responsibilities**: Summarize and synthesize multiple research papers, highlighting key findings, similarities, and differences.  
   - **Inputs**: A set of paper documents (PDFs or text) selected by the user; optionally a “focus” query (e.g. “compare how each paper approaches X”).  
   - **Outputs**:  
     - A structured Markdown (or JSON) report containing:  
       - A concise summary of each paper.  
       - A comparative analysis section (common themes, contradictions, unique contributions).  
       - A bullet‐list of open questions or future‐work suggestions.  
     - In‐text citations using labels like `[P1]`, `[P2]`, etc., which can be post‐processed to show titles or BibTeX keys.  
   - **UI Integration**:  
     - Triggered when the user selects ≥ 2 PDFs and clicks “Compare Papers” in the Casa UI (or via a chat command).  
     - Streams per‐paper progress (e.g. “Summarizing [P1] foo.pdf … ✅”) before rendering the final Markdown comparison in an overlay/modal.  
     - Offers “Insert into Notes” or “Save as Markdown” after generation.  
   - **Workflow & Prompt Design**:  
     1. **Per‐Paper Summarization**  
        - For each PDF, convert to Mathpix‐Markdown (if needed), chunk into sections (if very long), and call GPT‐4 (`gpt-4o`) to generate a ~300‐word summary.  
        - Cache each summary under `<projectId>/<pdf>.summary.md`.  
     2. **Aggregation & Synthesis**  
        - Once all summaries are ready, build a prompt:  
          ```txt
          System: “You are a meticulous research assistant. Compare the studies ONLY with the provided content. Cite each paper with [P#]. Do NOT hallucinate.”  

          User: “Focus: [focus or ‘overall comparison’]  
          
          Content provided:  
          [P1] <Summary of paper 1>  

          [P2] <Summary of paper 2>  
          …  

          Write a structured Markdown report with:
          • One‐paragraph overview for each paper (labelled).  
          • Comparative Analysis (agreements, differences, unique contributions).  
          • Open Questions / Future Work (bullet list).  
          Remember to cite using [P#].”
          ```  
        - Stream GPT‐4’s completion to the client (modal) in real time.  
     3. **“Focus” Modes**  
        - **Blank focus** → “summary” mode: normal per‐paper summarization then synthesis.  
        - **Any non‐blank focus** → treat as a generic query: fetch **full text** of each PDF and send everything (plus the focus question) to a single GPT‐4 prompt. That way you can ask arbitrary cross‐paper questions (e.g. “Any common citations?”).  
        - In all cases, cached results (by hashing `<paths> + <focus>`) are stored under `Comparisons/<hash>.cmp.md`. A repeat request with identical inputs returns the cached file in ≤ 1 s.  

   **Status**: (See Roadmap below)

2. **Citation Cluster Insertion & BibTeX Update Pipeline**  
   - **Responsibilities**:  
     - Given a context snippet or claim, recommend 2–3 supporting papers from the user’s existing library (via semantic retrieval + GPT filtering).  
     - Generate properly formatted BibTeX entries (or merge existing ones to avoid duplication).  
   - **Inputs**:  
     - A piece of manuscript text where a citation cluster is needed.  
     - Optional constraints (e.g., “must be from the last 5 years”).  
     - The project’s current `.bib` file.  
   - **Outputs**:  
     - A citation cluster (e.g. `\cite{Smith2020,Doe2019}` or `[Smith 2020; Doe 2019]`).  
     - Corresponding BibTeX entries (e.g.  
       ```bibtex
       @article{Smith2020,
         title={…},  
         author={Smith, Alice …},  
         journal={…},  
         year={2020},  
         …
       }
       ```  
       ) to append to the `.bib` file.  
   - **UI Integration**:  
     - The user positions the cursor or selects a sentence in the editor, clicks “Add Citation,” and the assistant uses this pipeline.  
     - The chat first presents “Candidate References: [Title – short description]” for user approval, then on approval inserts `\cite{…}` and patches `.bib`.  
   - **Workflow & Prompt Design**:  
     1. **Identify Keywords/Topic**:  
        - Optionally run a short GPT prompt to extract the gist (“deep learning image recognition”).  
     2. **Retrieve Candidates** (local only):  
        - Embed that topic and query the project’s vector‐store for top k relevant paper chunks.  
        - If found matches with existing BibTeX entries (by DOI/string match), reuse them. Otherwise, present the user with metadata (title, authors, year).  
     3. **Filter & Format**:  
        - Pass the selected 3–5 candidates (metadata only) into a GPT‐4 prompt:  
          ```txt
          System: “You are a reference assistant. Given these candidate papers (title, authors, year, one‐line summary each) and the context: ‘<user text>’, choose the 2–3 most relevant. Output:  
          • Citation cluster in author‐year format (e.g. `[Smith 2020; Doe 2019]`).  
          • Full BibTeX entries for each selected reference.”  
          ```  
        - GPT will output something like:  
          ```
          Citation: \cite{Smith2020,Doe2019}  

          @article{Smith2020,
            title={…},
            author={Smith, John and Lee, Alice},
            journal={…},
            year={2020},
            …
          }  

          @inproceedings{Doe2019,
            title={…},
            author={Doe, Jane},
            booktitle={CVPR},
            year={2019},
            …
          }
          ```  
     4. **Post‐Process & Persist**:  
        - Append new BibTeX entries to `<project>.bib` (skipping duplicates).  
        - Insert the citation cluster at the selected location in the manuscript.  

   **Status**: (See Roadmap below)

3. **Statistical Testing Assistant Pipeline**  
   - **Responsibilities**:  
     - Recommend the appropriate statistical test given a description of data or analysis goals.  
     - Optionally generate Python code to run the test, execute it, then interpret results in plain language.  
   - **Inputs**:  
     - A high‐level question (e.g. “I have two groups of measurements, how do I test if they differ?”).  
     - Optionally, a dataset file (CSV/JSON) or summary statistics.  
   - **Outputs**:  
     - Test recommendation (e.g. “Use an unpaired two‐sample t‐test because …”).  
     - If requested, code (Python/`pandas` + `scipy.stats`) to run that test.  
     - Numeric results (t‐statistic, p‐value) and a short interpretation (e.g. “p = 0.03, therefore significant at α = 0.05”).  
   - **UI Integration**:  
     - In chat: “Check if my data.csv has a normal distribution and recommend a test between A and B.”  
     - In notebook: right‐click on a DataFrame → “Statistical Assistant.”  
     - The pipeline displays recommendations and can insert a new code cell (if the user asks to run the test).  
   - **Workflow & Prompt Design**:  
     1. **Classify Task**:  
        - If input contains actual data (CSV selected), run a quick Python snippet to compute summary stats (mean, variance, Shapiro‐Wilk).  
        - Otherwise, treat as a test‐selection request.  
     2. **Generate or Interpret**:  
        - If recommending a test: prompt GPT:  
          ```txt
          System: “You are a stats consultant. The user has data: [description/summary]. They want to compare group means. Provide (a) the best statistical test, (b) why, (c) necessary assumptions.”  
          ```  
        - If running a test:  
          - GPT generates Python code (e.g.,  
            ```python
            import pandas as pd
            from scipy.stats import ttest_ind

            df = pd.read_csv('data.csv')
            group1 = df[df['Group']=='A']['Value']
            group2 = df[df['Group']=='B']['Value']
            stat, pval = ttest_ind(group1, group2)
            print(stat, pval)
            ```  
            )  
          - Casa executes that code in a sandboxed Python environment, captures `(stat, pval)`, then prompts GPT again:  
            ```txt
            System: “You are a stats consultant. The t‐test returned t = 2.1, p = 0.04. Interpret this result for the user in 2‐3 sentences.”  
            ```  
     3. **Present Results**:  
        - Return a Markdown bullet list:  
          ```
          • Recommended test: Unpaired two‐sample t‐test  
          • t‐statistic = 2.10, p‐value = 0.04  
          • Conclusion: p < 0.05, so we reject H₀; there is a significant difference between the two groups.  
          ```  

   **Status**: (See Roadmap below)

4. **Pseudocode‐to‐Code Generation Pipeline**  
   - **Responsibilities**: Translate pseudocode or algorithm descriptions into working source code (e.g. Python, Java).  
   - **Inputs**:  
     - A snippet of pseudocode or natural‐language algorithm (“For each item in list, if value > threshold, append to output”).  
     - Target language (e.g. “Generate Python code”).  
     - Optional “existing code context” (so naming conventions match).  
   - **Outputs**:  
     - A complete code block in the requested language, including necessary imports and comments.  
   - **UI Integration**:  
     - In chat: User pastes pseudocode → “Generate code in Python.”  
     - In editor: Highlight pseudocode block and click “Translate to code.”  
     - Casa suggests a new code cell (for notebooks) or replaces the pseudocode comment with the generated code.  
   - **Workflow & Prompt Design**:  
     1. **Determine Language & Context**:  
        - If the project context indicates Python (e.g. other cells import `pandas`), add that to the prompt.  
     2. **GPT‐4 Prompt**:  
        ```txt
        System: “You are a senior software engineer. Translate the following pseudocode into working Python code. Include necessary imports and comments. Use idiomatic Python style.”  

        User: “Pseudocode:  
          for each item in data_list:  
            if item.value > threshold:  
              add item to results_list  
        ”  
        ```  
     3. **Iterative Debug Loop** (optional):  
        - If the user asks “Run this,” Casa executes in a sandbox. If an error arises, capture the traceback and prompt GPT to fix. Repeat until the code runs or a maximum of 2–3 iterations.  

   **Status**: (See Roadmap below)

5. **Inline LaTeX Completion & Academic Writing Pipeline**  
   - **Responsibilities**: Provide context‐aware completions and rewriting suggestions for LaTeX/Markdown documents (sentences, equations, citations).  
   - **Inputs**:  
     - The current cursor position and surrounding text in a LaTeX/Markdown document.  
     - Optional style guidelines (“Use formal tone, maintain IEEE style”).  
   - **Outputs**:  
     - Inline text or equation continuations (e.g. completing `$\frac{d}{dx}…` → `$\frac{d}{dx} \sin(x) = \cos(x)$`).  
     - Suggestions for next sentences or phrase‐level rewrites (“Rephrase this sentence to be more concise and formal”).  
   - **UI Integration**:  
     - As you type in the Casa editor (LaTeX/MD), a ghost text suggestion appears or a pop‐up offers alternative completions.  
     - In chat: “Rephrase the previous sentence in formal academic tone.”  
   - **Workflow & Prompt Design**:  
     1. **Context Gathering**:  
        - Extract the last ~500–1000 characters around the cursor (including any open math delimiters).  
     2. **Mode Detection**:  
        - If inside `$…$` or `\[…\]`, treat as “math mode”. Otherwise, “text mode.”  
     3. **GPT‐4 Prompt**:  
        - **Text mode**:  
          ```txt
          System: “You are an AI academic writing assistant. Continue the following text in the same style and tone, starting from the cursor.”  
          User: “… in our experiments, we observed that the accuracy improved by 15% over the baseline. <|cursor|>”  
          ```  
        - **Math mode**:  
          ```txt
          System: “You are an AI LaTeX assistant. Complete this math expression.”  
          User: “$\Delta E = -k_B T \ln(Z) <|cursor|>$”  
          ```  
     4. **Insertion**:  
        - The model returns only the continuation (no extra commentary).  
        - Casa inserts it at the cursor.  

   **Status**: (See Roadmap below)

6. **AI‐Powered PDF Summarization & Section Extraction Pipeline**  
   - **Responsibilities**: Summarize entire PDFs (especially research papers) and extract or answer targeted queries about specific sections (e.g. “Methods,” “sample size,” “figure captions”).  
   - **Inputs**:  
     - One or more PDF files (uploaded or already in the project).  
     - An optional instruction:  
       - “Summarize entire document.”  
       - “Extract the X section.”  
       - “What is the sample size in this study?” (PDF‐Q&A).  
   - **Outputs**:  
     - **Full summary**: A concise, structured Markdown overview (Background, Methods, Results, Conclusion).  
     - **Section extraction**: The raw text of that section (cleaned) or a short summary if it’s very long.  
     - **PDF‐Q&A**: A specific answer quoting from the PDF (e.g. “The sample size was 100 participants (Methods, p. 5)”).  
   - **UI Integration**:  
     - In the PDF viewer side panel: click “AI Summary” → Casa shows the summary in a side panel or chat.  
     - Highlight “Conclusion” in the PDF → Right‐click → “Extract ‘Conclusion’” → Casa jumps to that section or returns it.  
     - Chat: “Summarize foo.pdf’s introduction.”  
   - **Workflow & Prompt Design**:  
     1. **PDF → Mathpix‐Markdown**  
        - On first request for `<file>.mmd`, convert via `mathpixService` and cache under `<projectId>/<file>.mmd`.  
     2. **Chunk & Summarize**  
        - If `mmd.length < ONE_SHOT_LIMIT (~110 k chars)`, send one GPT‐4 call to produce a full summary (max 1024 tokens).  
        - Otherwise, chunk by headings (~50 k chars each, 1 k overlap), summarize each (~150 words via GPT), then merge summaries (GPT‐4) into a coherent overview.  
     3. **Section Extraction**  
        - Use `extractSection(projectId, path, sectionName)` to find heading indices in the cached `.mmd`.  
        - If found, return raw section. If the user asked for a summary of that section, send it to GPT‐4 with “Summarize this in **200 words** max.”  
     4. **PDF‐Q&A (Retrieval + RAG)**  
        - Split the PDF into paragraph chunks, embed via `OpenAI Embeddings`.  
        - Do a similarity‐search in `vectorService` to find top k relevant chunks.  
        - Prompt GPT‐4:  
          ```txt
          System: “Answer using ONLY the provided context sections. If not found, say ‘I don’t know.’ Cite facts in [Section] format.”  
          User: “Question: ‘What is the sample size?’  
          
          Context sections:  
          [Methods] <chunk 1>  
          [Results] <chunk 2>  
          …  
          
          Answer:”  
          ```  
        - Cache each `(path, question)` result under `<projectId>/<path>.<hash>.qa.md`.  
   - **UI Integration**:  
     - PDF side panel, chat, or “Ask AI” overlay on open PDF.  

   **Status**: (See Roadmap below)

7. **Semantic Search & Context Retrieval Pipeline**  
   - **Responsibilities**: Provide semantic search across all files (notes, PDFs, code, etc.) in a project. Retrieve relevant snippets or answer natural‐language queries using RAG.  
   - **Inputs**:  
     - A free‐text query or question (e.g. “Where did I discuss convolution?”).  
     - Optional filters (e.g. “only search PDFs” or “only my notes folder”).  
   - **Outputs**:  
     - **Search mode**: JSON array of top results:  
       ```jsonc
       [
         {
           "file": "literature_review.md",
           "snippet": "Here is the context around the match…",
           "score": 0.87
         },
         {
           "file": "paperX.pdf",
           "snippet": "… convolutional neural network …",
           "score": 0.81
         }
       ]
       ```  
       - Casa’s UI renders these as clickable results, highlighting the snippet.  
     - **QA mode**: A synthesized answer compiled from multiple chunks, with attributions (e.g. “Convolution is an operation that … (see methods.md, lines 10–15)”).  
   - **UI Integration**:  
     - A global search bar in the Casa sidebar or chat (`“Search project for X”`).  
     - Results panel lists filenames + snippets; clicking opens the file at the corresponding location.  
     - If a question in chat, the assistant returns a synthesized answer.  
   - **Workflow & Prompt Design**:  
     1. **Indexing / Preprocessing** (background):  
        - On project load or when files change, chunk every text file (notes, `.mmd` from PDFs, code comments, Markdown) into ~200‐token overlapping chunks.  
        - Call `OpenAI Embeddings (e.g. ada‐002)` → store embeddings + metadata (`filename`, `section`, `chunkId`) in a vector store (e.g. Pinecone, Weaviate, or local).  
     2. **Query Embedding & Retrieval**:  
        - Embed the user query.  
        - Perform a nearest‐neighbor search (top K, e.g. 8–10) in the vector store, optionally applying filetype filters.  
     3. **Optional Rerank / Summarize**:  
        - If it’s a “search” (just showing matches), return raw snippets.  
        - If it’s a “question” (QA mode), build a GPT prompt:  
          ```txt
          System: “Answer using ONLY the provided context. Cite each source in [Filename:Section] format. If not in context, say ‘I don’t know.’”  
          User: “Question: ‘…’  

          Context:  
          ---  
          [fileA.md:Introduction] <text>  
          ---  
          [paper1.pdf:Methods] <text>  
          …  
          ---  

          Answer:”  
          ```  
        - Stream GPT’s response back to the chat.  
   - **UI Integration**:  
     - Search bar, chat commands, or context‐aware “Find in Project” panel.  

   **Status**: (See Roadmap below)

8. **Dataset Analysis & Visualization Helpers Pipeline**  
   - **Responsibilities**: Provide exploratory data analysis (EDA) and visualization support for tabular datasets (CSV, JSON). Generate summary stats, plots, and narrative interpretations.  
   - **Inputs**:  
     - A dataset file (e.g. `data.csv`) or a snippet of data.  
     - Optional specific requests: “Plot column A vs B,” “Describe this dataset,” “What is the average of X for group Y?”  
   - **Outputs**:  
     1. **Data Profiling**:  
        - A Markdown summary: “The dataset has 1,000 rows, 5 columns (Age, Gender, Income, etc.). Mean(Income) = \$50k, median = \$48k, no missing values. Age distribution is approximately normal (skew=0.2).”  
     2. **Visualizations**:  
        - Generated Python code (Matplotlib/`pandas`) to produce the requested plot.  
        - The rendered image (PNG) embedded in the chat or as a file link.  
        - A brief narrative: “The scatter plot of A vs B shows a strong positive correlation (r = 0.85).”  
     3. **Direct Q&A**:  
        - For a specific statistic, run code behind the scenes and respond: “Avg. Income for males = \$52k; for females = \$48k.”  
   - **UI Integration**:  
     - Selecting a dataset file triggers a “Data Inspector” panel.  
     - In chat: “Show a histogram of column X in data.csv.”  
     - In notebooks: “Describe df” or “Plot df['A'] vs df['B']” → a new code cell is generated + executed, then plot shown inline.  
   - **Workflow & Prompt Design**:  
     1. **Profiling (Python backend)**  
        - Casa loads the CSV in a sandboxed Python environment, computes summary stats (`df.describe()`, missing‐value counts, dtypes).  
        - Pass those summary stats as text to GPT‐4 with:  
          ```txt
          System: “You are a data science assistant. Summarize the following dataset profile concisely.”  
          User: “Dataset: 1000 rows, columns: Age (int), Gender (cat), Income (float). Mean(Income)=50000, median=48000, skew=0.2. 0 missing values. Male count=520, Female=480. …”  
          ```  
     2. **Visualization (Code + Execution)**  
        - If user requests a plot, prompt GPT:  
          ```txt
          System: “Generate Python code using matplotlib to plot a histogram of ‘Income’ from data.csv. Include necessary imports. Output only code.”  
          ```  
        - Casa runs that code, saves a `PNG`, re‐prompts GPT:  
          ```txt
          System: “Given this plot image, describe any visible trends or patterns.”  
          User: “Correlation between A and B appears strong in the scatter plot. Points cluster around a straight line.”  
          ```  
     3. **Q&A on Data**  
        - If the user asks “What is the average Income for each Gender?”, generate code:  
          ```python
          import pandas as pd

          df = pd.read_csv('data.csv')
          df.groupby('Gender')['Income'].mean()
          ```  
        - Execute, capture the results (`{'Male': 52000, 'Female': 48000}`), then prompt GPT:  
          ```txt
          System: “Interpret these results in 1–2 sentences.”  
          User: “Male: 52k, Female: 48k.”  
          ```  
   - **UI Integration**:  
     - “Data Inspector” panel, chat commands, notebook integration.  

   **Status**: (See Roadmap below)

---

## PHASED ROADMAP:  
**Phase 1: Core Context & Retrieval Foundation**  
1. **Semantic Search & Context Retrieval** (#7)  COMPLETED 
   - Index all project files → enable semantic queries + QA.  
   - **Status**: Completed.  
2. **AI‐Powered PDF Summarization & Section Extraction** (#6)  COMPLETED
   - Summarize full PDFs, extract sections, answer PDF‐Q&A.  
   - **Status**: Completed.  

**Phase 2: Knowledge Synthesis & Writing**  
1. **Multi‐Paper Synthesis & Comparison** (#1)  COMPLETED
   - Compare multiple papers & produce structured Markdown reports.  
   - **Status**: Completed.  
2. **Citation Cluster Insertion & BibTeX Update** (#2)  
   - Recommend citation clusters & update `.bib`.  
   - **Status**:  STARTED, INCOMPLETE
3. **Inline LaTeX Completion & Academic Writing** (#5)  
   - Context‐aware sentence/equation completions in LaTeX/Markdown.  
   - **Status**:  STARTED, INCOMPLETE

**Phase 3: Code & Data Analysis**  
1. **Pseudocode‐to‐Code Generation** (#4)  
   - Convert user pseudocode or algorithm descriptions to runnable code.  
   - **Status**: NOT STARTED.  
2. **Notebook Cell Generation & Editing** (#9)  
   - AI assistance for generating/refactoring notebook cells in context.  
   - **Status**: NOT STARTED.  
3. **Multi‐File Symbolic Refactoring** (#10)  
   - Project‐wide refactoring (rename functions, migrate APIs across files).  
   - **Status**: NOT STARTED.  
4. **Statistical Testing Assistant** (#3)  
   - Recommend and run statistical tests; interpret results.  
   - **Status**: NOT STARTED.  
5. **Dataset Analysis & Visualization Helpers** (#8)  
   - Automatic EDA, code generation for plots, narrative interpretations.  
   - **Status**: NOT STARTED.  

**Phase 4: Advanced Research Workflows**  
1. **Experimental Protocol Drafting** (#11)  
   - Draft structured experimental protocols (Introduction, Methods, Analysis plan).  
   - **Status**: Planned.  
2. **Literature Gap Visual Mapping** (#12)  
   - Build a conceptual map of research topics & highlight under‐studied gaps.  
   - **Status**: Planned.  
3. **Peer‐Review Simulation** (#13)  
   - Simulate 1–2 peer reviews (major/minor points, recommendations).  
   - **Status**: Planned.  
4. **Slide Deck Generation** (#14)  
   - Generate slide‐by‐slide outlines with titles and bullet points for talks.  
   - **Status**: Planned.  

---
