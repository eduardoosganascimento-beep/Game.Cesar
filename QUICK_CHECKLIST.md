# Sandman v1.0 Quick Checklist

## ✅ Build
- [x] `npm run build` — 0 TypeScript errors
- [x] Vite build completes successfully

## ✅ Tutorial System
- [x] Button "Tutorial" in main menu (index.html line 75)
- [x] Tutorial screen with data-screen="tutorial" (index.html line 172)
- [x] showTutorial()/hideTutorial() in screens.ts
- [x] 'tutorial' case in activate() switch (screens.ts line 269)
- [x] onTutorial handler in main.ts (line 1333)
- [x] onTutorialClose handler in main.ts (line 1338)

## ✅ Difficulty System
- [x] Difficulty type 'facil'|'normal'|'dificil' (difficulty.ts line 5)
- [x] DELTAS factory with speed/damage/enemies multipliers (difficulty.ts lines 15-23)
- [x] localStorage persistence readDifficulty/writeDifficulty (difficulty.ts lines 31-47)
- [x] Game.difficulty field = readDifficulty() (main.ts line 96)
- [x] setDifficulty(difficulty) + getDifficulty() (main.ts lines 126-129)
- [x] Difficulty selector in menu UI (screens.ts setDifficultySelection)
- [x] Enemy speed scaled via DELTAS.speed[difficulty] (main.ts lines 194-198)
- [x] Player damage scaled via DELTAS.damage[difficulty] (main.ts line 709)

## ✅ GitHub & Deploy
- [x] Repo connected, push working
- [x] GitHub Pages via Actions deployed
- [x] Public URL: https://eduardoosganascimento-beep.github.io/Game.Cesar/
- [x] Latest build index-C_h5_jWF.js serving correctly