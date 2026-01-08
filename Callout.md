# Blog Content Tools & Formatting Guide

This blog uses **Astro + MDX** with a small set of content-focused tools.
The goal is to keep writing close to Markdown while allowing structured, readable blocks for notes, math, and teaching-style content.

---

## 1. Callout Component

### What is a Callout?

A **Callout** is a content block used to visually separate important material such as definitions, theorems, warnings, examples, or extra resources.

It is implemented as an MDX component:

```mdx
<Callout>
  Content goes here.
</Callout>
```

Callouts are **content containers**, not styling hacks.
They can contain **any valid MDX**:

* paragraphs
* lists
* tables
* code blocks
* math
* images
* nested Callouts

---

### Importing Callout

Any MDX file that uses Callouts must include this import **below frontmatter**:

```mdx
import Callout from '@/components/Callout.astro'
```

---

### Callout Props

| Prop          | Description                                       | Default     |
| ------------- | ------------------------------------------------- | ----------- |
| `variant`     | Type of callout (note, definition, theorem, etc.) | `"note"`    |
| `title`       | Optional heading shown at top of callout          | `undefined` |
| `defaultOpen` | Whether the callout’s `<details>` section is open | `true`      |

Example:

```mdx
<Callout variant="definition" title="Span">
  Definition content.
</Callout>
```

---

## 2. Callout Variants (Semantic Meaning)

Each variant represents **intent**, not just color.

### General-purpose

Use these for blog-style writing:

* `note` – general information or side notes
* `tip` – advice or shortcuts
* `warning` – pitfalls or misconceptions
* `danger` – destructive or irreversible actions
* `important` – required knowledge for understanding

Example:

```mdx
<Callout variant="important" title="API Change">
  This version breaks backward compatibility.
</Callout>
```

---

### Academic / Math / Notes-style

Use these for lecture notes or formal writing:

* `definition`
* `theorem`
* `lemma`
* `proof`
* `corollary`
* `proposition`
* `axiom`
* `conjecture`
* `notation`
* `remark`
* `intuition`
* `recall`
* `explanation`
* `example`
* `exercise`
* `problem`
* `answer`
* `solution`
* `summary`

These variants are designed to **nest naturally**:

```mdx
<Callout variant="theorem" title="Law of Large Numbers">
  Statement of theorem.

  <Callout variant="proof">
    Proof goes here.
  </Callout>
</Callout>
```

---

### Exercise-style Pairing

Recommended pattern for hiding answers:

```mdx
<Callout variant="exercise" title="Compute the derivative">
  Find the derivative of $f(x)=x^3\sin x$.

  <Callout variant="answer" defaultOpen={false}>
    $3x^2\sin x + x^3\cos x$
  </Callout>
</Callout>
```

* `answer`: short final result
* `solution`: full worked steps

---

## 3. When to Use Callouts (Guidelines)

Use a Callout when the content is:

* **Labeled** (Definition, Theorem, Example, etc.)
* **Interrupting the flow** (extra reading, warnings, reminders)
* **Structurally important** (proofs, exercises, summaries)

Do **not** use Callouts for:

* normal paragraphs
* regular explanations that fit inline
* purely stylistic emphasis

---

## 4. Math Support

The blog supports LaTeX math:

* Inline: `$a^2 + b^2 = c^2$`
* Block:

  ```md
  $$
  \int_0^1 x^2 \, dx = \frac{1}{3}
  $$
  ```

Math works inside Callouts, lists, and nested blocks.

---

## 5. Code Blocks

Standard fenced code blocks are supported, including metadata:

````
```js title="example.js"
console.log("Hello world")
```
````

Code blocks may appear:

* inside Callouts
* inside lists
* inside proofs or examples

Code content should never be altered for formatting reasons.

---

## 6. Images & Figures

### Simple Image

```md
![Alt text](./image.png)
```

### Centered Figure with Caption (Preferred)

```mdx
<div class="mx-auto w-[70%]">
![Vector addition](./s1.png)
*Figure 1: Vector addition visualization*
</div>
```

Guidelines:

* Captions are italicized
* Figures may be referenced in text
* Do not invent figure numbers

---

## 7. HTML & Embeds

Raw HTML is allowed when needed (e.g., YouTube embeds):

```mdx
<div class="relative mt-4 w-full overflow-hidden rounded-xl" style="padding-top: 56.25%;">
  <iframe
    src="https://www.youtube.com/embed/..."
    title="Video"
    class="absolute left-0 top-0 h-full w-full"
    allowfullscreen
  ></iframe>
</div>
```

HTML blocks should be visually separated with blank lines.

---

## 8. Frontmatter Expectations

Each blog/note starts with YAML frontmatter:

```yaml
---
title: 'Post title'
description: 'Short description'
date: 2025-10-03
tags: ['linear-algebra', 'lecture']
image: './banner.png'
authors: ['YourName']
---
```

Frontmatter describes metadata only — never content.

---

## 9. Philosophy

* Writing comes first, formatting second
* Callouts express **structure**, not decoration
* Content should remain readable as plain MDX
* Minimal tooling, maximum clarity

