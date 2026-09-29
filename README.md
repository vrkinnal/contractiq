# ContractIQ

**Document intelligence for business users.**

ContractIQ lets users upload PDF documents and ask questions about them in plain English. It uses RAG to retrieve relevant information from the uploaded documents and generate answers grounded in the source content.

### Tech Stack

* Angular 21
* Supabase / PostgreSQL
* pgvector
* Gemini API — embeddings
* Groq API — LLM
* RAG (Retrieval-Augmented Generation)

### How it works

```text
PDF → Text Extraction → Chunking → Gemini Embeddings
                         ↓
                   Supabase + pgvector
                         ↓
                    User Question
                         ↓
                  Vector Similarity Search
                         ↓
                 Relevant Document Chunks
                         ↓
                     Groq LLM
                         ↓
                      Answer
```

### Use Cases

ContractIQ can be used to query:

* HR policies
* Contracts and legal documents
* Project documentation
* Business manuals
* Multiple documents together

Instead of searching through a long PDF manually, users can simply ask:

> "What is the leave policy?"

or

> "Who is responsible for approving the project release?"

and get an answer based on the uploaded documents.

### Running locally

```bash
npm install
ng serve
```

Add your Supabase, Gemini, and Groq credentials to your environment configuration before running the application.

---

Built with **Angular, Supabase, Gemini, Groq and RAG**.
