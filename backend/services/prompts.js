// backend/services/prompts.js
/**
 * Central prompt registry.
 * Tweak copy here without touching route logic.
 */

 module.exports = {
    /* ---------- Summaries ---------- */
    summarySystem :
      'You are an expert at summarizing scientific research papers.',
  
    summaryOneShotUser : () => `
  Below is the full Mathpix-Markdown of a research paper.  
  Write a **300-word structured summary** with headings:
  
  **Background**  
  **Methods**  
  **Results**  
  **Conclusion**
  
  Quote any numbers exactly as they appear.`.trim(),
  
    sectionSummarySystem :
      'You are an expert summarizer.',
  
    mergeSummarySystem :
      'You are an expert at synthesizing concise structured summaries.',
  
    mergeSummaryUser : sectionSummaries => `
  Below are summaries for each section of a research paper.  
  Please **write a 300-word** coherent summary with headings:
  
  Background / Methods / Results / Conclusion
  
  Use only what is provided.
  
  ${sectionSummaries.map(ss => `**${ss.section}**:\n${ss.summary}`).join('\n\n')}`.trim()
  };
  