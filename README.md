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

## Правила кода (выучены на баг-репортах)
- Любая подписка на `this.game.events` снимается в `this.events.once('shutdown', …)`. Иначе остановленная сцена продолжает получать события и пишет в уничтоженные объекты.
- Переходы между экранами через `scene.start` всегда идут после явной остановки оверлеев (`facet`, `door`, `pause`, `summary`).
- Не использовать `TileSprite` — после `scene.stop` он получает холст без 2D-контекста из пула.
- Все числа — в `src/data/*.json`; код читает их, а не хранит.

## E2E локально без скачивания браузера
```
npm run build
npm run test:e2e          # использует системный Microsoft Edge
set PW_CHANNEL=chrome && npm run test:e2e   # или Google Chrome
```

## Симуляция без браузера (tests/sim)
`npm test` теперь гоняет и headless-симуляцию: Phaser запускается под Node (jsdom + canvas), время продвигается вручную,
клавиши эмулируются. Так проверяются переходы комнат, Грани, двери, смерть и босс. Если `npm install` не смог собрать
пакет `canvas`, юнит-тесты всё равно работают — упадут только `tests/sim`.
