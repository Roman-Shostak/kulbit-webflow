# Kulbit — Довідник: розмітка hero + Vimeo

> Винесено з CLAUDE.md (§15) для зменшення основного контексту. Читай за потреби (робота з hero/відео).

---


> ⚠️ Локальний експорт `kulbit-gsap.webflow/` **застарілий** (опублікований до додавання атрибутів). Актуальний стан верстки — на **staging** (`kulbit-gsap.webflow.io`) і через **Webflow MCP** (`webflow_guide_tool` спершу). Класи/структура нижче стабільні.

### DOM hero (секція 0)

```html
<header data-kulbit-header class="header">        <!-- absolute; z-index:100; inset:1.5rem 0 auto -->
  ... logo + <button class="button" data-kulbit-border> ...
</header>
<main class="main">
  <section data-kulbit-section class="section is-hero">
    <div class="container">
      <div class="flex-h-v-v is-hero">              <!-- блок контенту (h1 + кнопка + текст) -->
        <div class="width-590-a-a position-relative"><h1 class="text-size-h1">…</h1><div class="hero-h1-blur"></div></div>
        <div class="divider is-hero desktop-hide"></div>   <!-- сховано ≥992 -->
        <button class="button is-hero">…Start Pilot… <div class="icon-56 w-embed">…</div></button>
        <div class="hero-text-wrapper">…</div>       <!-- absolute (inset відносно .section) -->
      </div>
    </div>
    <div class="hero-video-wrapper">                 <!-- z-index:-1; absolute inset:0 -->
      <div class="hero-video-mask"></div>            <!-- z-index:75; радіальна віньєтка; pointer-events:none -->
      <div class="hero-video">                       <!-- z-index:50; absolute inset:0; pointer-events:none -->
        <div class="width-height-100 w-embed">       <!-- Embed: сюди iframe Vimeo (100%×100%) -->
          <iframe …></iframe>
        </div>
      </div>
    </div>
    <button class="hero-video-button">               <!-- z-index:100; коло; absolute inset:0; margin:auto (центр) -->
      <div class="hero-button-circle"><div class="hero-button-circle is-second">
        <div class="icon-24-24-16 w-embed">…динамік…</div>            <!-- звук УВІМК -->
        <div class="icon-24-24-16 is-mute w-embed">…перекреслений…</div> <!-- мут; CSS opacity:0, absolute -->
      </div></div>
    </button>
  </section>
  <section data-kulbit-section class="section"></section>  <!-- ×6 порожні -->
</main>
<footer data-kulbit-section class="section footer"></footer>
```

### Ключові CSS-факти (Webflow)

- `.section { width:100%; min-height:100vh; position:relative; overflow:hidden }` — JS на проді перебиває на `absolute; height:100vh` (стекінг, ADR-010).
- `.hero-text-wrapper` — `position:absolute`, точка відліку = `.section` (бо `.flex-h-v-v` і `.container` обидва `static`). **⚠️ GOTCHA:** воно DOM-дитина `.flex-h-v-v.is-hero`, тож трансформ на батькові тягне і його (transform re-roots containing block). Тому **desktop** анімує дітей окремо (`.width-590-a-a`, `.button.is-hero`), а не сам флекс; **tablet** навмисне рухає весь `.flex-h-v-v` (текст їде разом — це бажано).
- `.hero-video-button { width:16.56rem; aspect-ratio:1; margin:auto; inset:0 }` — має **окремі CSS-правила під ≤991 і ≤767** (тому таблет рахує центр кнопки через `getBoundingClientRect`, не припускає vh/2).
- **rem = viewport-based** (Wizardry converter): base `font-size:0.8333vw`, `@max-width:991px → 2.15vw`, `@max-width:479px → 4.10vw`. Тобто rem масштабується з шириною.

### Vimeo — embed для вставки в `.width-height-100` (Webflow Embed)

ID `1180786664`, hash `865b5a46af`. Встав **лише iframe** (без padding-обгортки), `&background=1` обов'язково:

```html
<iframe
  src="https://player.vimeo.com/video/1180786664?h=865b5a46af&background=1&dnt=1"
  allow="autoplay; fullscreen; picture-in-picture"
  frameborder="0"
  title="Kulbit Showreel"
  style="display:block;width:100%;height:100%;border:0;"></iframe>
```

`player.js` Vimeo SDK підключено в Webflow Footer ПЕРЕД бандлом. Звук — кнопка `[data-kulbit-sound]` (старт muted).

### Повна мапа data-атрибутів hero (на staging)

| Елемент | Desktop (ADR-009) | Tablet (`-tablet`, ADR-011) | Інше |
| --- | --- | --- | --- |
| `header` (`data-kulbit-header`) | `data-kulbit-y="-400"` `data-kulbit-fade="0"` | `data-kulbit-y-tablet="-400"` `data-kulbit-fade-tablet="0"` | — |
| `.hero-text-wrapper` | `data-kulbit-y="-300"` `data-kulbit-fade="0"` | (їде разом із `.flex-h-v-v`) | — |
| `.width-590-a-a` (H1) | `data-kulbit-y="300"` `data-kulbit-fade="0"` | — | — |
| `.button.is-hero` | `data-kulbit-y="300"` `data-kulbit-fade="0"` | — | — |
| `.flex-h-v-v.is-hero` | — | `data-kulbit-y-tablet="300"` `data-kulbit-fade-tablet="0"` | — |
| `.hero-video-mask` | `data-kulbit-fade="0"` | `data-kulbit-fade-tablet="0"` | — |
| `.width-height-100` (embed) | `data-kulbit-scale="1"` `data-kulbit-scale-from="1.3"` | `data-kulbit-scale-tablet="1"` `data-kulbit-scale-from-tablet="1.3"` | `data-kulbit-video` + iframe ↑ |
| `.hero-video` | — | — | (нічого; скейл лише через embed) |
| `.hero-video-button` | — | — | `data-kulbit-sound` |
| кнопка(и) у header/CTA | — | — | `data-kulbit-border` (ховер-бордер) |

(Числа `y`/швидкості калібруються вільно — це лише атрибути.)
