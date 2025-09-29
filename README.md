# GitHub Repo Tree Viewer

A simple static GitHub repo tree viewer, to allow embedding a tree view of a GitHub repo on any website.

## Example

[Example Link](https://designthinkerer.github.io/tree-viewer/?repo=https://github.com/facebook/react&expand=false&transparent=true&theme=light)

To embed it in your website, you can use an `iframe`:

```html
<iframe src="https://designthinkerer.github.io/tree-viewer/?repo=https://github.com/facebook/react&expand=false&transparent=true&theme=light" frameborder="0" style="width: 100%; height: 500px;"></iframe>
```

<img width="2022" height="1293" alt="image" src="https://github.com/user-attachments/assets/5653bd20-1f4e-43db-9f2b-168204e1ff88" />

## Configuration

The tree viewer is configured through URL parameters in the `iframe`'s `src` attribute.

| Parameter | Values | Description |
| :--- | :--- | :--- |
| `repo` | `string` | **Required**. The full URL of the public GitHub repository you want to display. Example: `https://github.com/facebook/react`. |
| `theme` | `light` \| `dark` | Sets the color theme. If omitted, it respects the user's system preference (`prefers-color-scheme`). |
| `transparent`| `true` \| `false` | If `true`, the background of the viewer will be transparent. Default is `false`. |
| `expand` | `true` \| `false` | If `true`, all folders in the repository tree will be expanded by default. Default is `false`. |
