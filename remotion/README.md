# Remotion · Tío José María

Vídeos programáticos para la web y redes sociales.

## Compositions

| ID | Tamaño | Duración | Uso |
|---|---|---|---|
| `KenBurnsHero` | 1920×1080 | 18s loop | Fondo de la home (`<video>` mute autoplay loop) |
| `ReviewReel` | 1080×1920 | 12s | Reel Instagram cuando llega review 5★ |
| `WelcomeVideo` | 1080×1920 | 13s | Adjunto en email de confirmación al huésped |

## Desarrollo local

```bash
cd remotion
npm install
npm start              # abre Remotion Studio en localhost:3000
```

## Renderizado manual

```bash
npm run render:hero
npm run render:review
npm run render:welcome
```

Salida en `out/`.

## Render automático

- **Hero**: workflow GitHub Actions `render-hero.yml` con `workflow_dispatch`. Se ejecuta manualmente desde GitHub cuando cambien las fotos del bucket.
- **Review reel**: workflow `render-review-reel.yml` disparado por edge function `trigger-reel-render` cuando se inserta review 5★.
- **Welcome video**: hook en edge function `notify-booking` cuando admin confirma reserva.

## Props dinámicas

Los compositions aceptan props via `--props` en CLI:

```bash
npx remotion render src/index.ts ReviewReel out/r.mp4 \
  --props='{"rating":5,"author":"María","comment":"...","apartmentName":"Tomillo","apartmentImage":"https://..."}'
```
