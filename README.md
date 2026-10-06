# Arkfall — прототип боя (этап 0)

Top-down action roguelike. Phaser 3 + TypeScript + Vite. Все числа боя — в `src/data/*.json`, формулы GDD §5–6 — в `src/core/formulas.ts`.

## Запуск
```
npm install
npm run dev        # http://localhost:5173
npm test           # юнит-тесты формул
npm run build      # tsc + vite
npm run test:e2e   # дымовой Playwright (нужен npx playwright install)
```

## Параметры URL
`?tier=3&room=5&seed=42&debug` — Тир, комната, сид, отладка хитбоксов.

## Ворота этапа 0
- Средний TTK обычного моба 0,6–1,5 с (показан в HUD справа сверху).
- Каждая атака врага телеграфируется ≥ 0,4 с (контур → заливка).
- Бой «приятен» PM после 10 минут — субъективная проверка, фиксируется в GDD.
