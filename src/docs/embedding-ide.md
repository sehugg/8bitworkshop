## Embedding the IDE in a web page

You can embed the IDE using an IFRAME element:

```html
<iframe src="https://8bitworkshop.com/redir.html?embed=1&..."></iframe>
```

Query-string parameters:

| Name | Value |
| --- | --- |
| `embed` | must be `1` |
| `platform` | platform ID (for example `vcs`) |
| `file0_name` | name of the main file |
| `file0_data` | text content of the main file |
| `highlight` | (optional) line range to highlight (for example `2,4`) |

The IDE uses browser storage tied to the referrer URL, so each page
containing embeds is effectively sandboxed from the others.

Example using Bootstrap's `embed-responsive` class:

```html
<div class="embed-responsive embed-responsive-16by9">
  <iframe class="embed-responsive-item" loading="lazy"
    src="https://8bitworkshop.com/redir.html?embed=1&platform=nes&highlight=&file0_name=testembed.dasm&file0_data=..."></iframe>
</div>
```
