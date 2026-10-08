"""
Генератор пиксельных спрайтов Arkfall (32 px, вид сверху-сбоку).
Спрайт описывается примитивами на сетке 32×32; контур и затенение накладываются автоматически,
чтобы все персонажи были в одном стиле. python3 tools/sprites/gen.py → public/sprites/*.png + preview.
"""
from PIL import Image, ImageDraw
import os, math

S = 32
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'sprites')

PAL = {
    'k': (26, 20, 32),      # контур
    # герой
    'c': (245, 241, 230), 'C': (201, 194, 176), 'b': (143, 211, 255), 'B': (63, 127, 176),
    'g': (111, 120, 144), 'G': (58, 66, 86), 'w': (223, 232, 230), 'h': (201, 162, 39),
    'a': (54, 58, 72), 'A': (30, 32, 42), 'q': (178, 32, 44), 'Q': (110, 16, 28), 'x': (255, 70, 70), 'd': (150, 160, 176),
    # рвущийся
    'r': (224, 85, 58), 'R': (138, 47, 31), 'e': (255, 210, 122), 't': (245, 241, 230),
    # молот
    'y': (201, 162, 39), 'Y': (122, 94, 20), 'm': (154, 164, 184), 'M': (90, 98, 112),
    # стрелок
    's': (111, 183, 255), 'S': (52, 96, 150), 'p': (255, 179, 107),
    # подземельный бестиарий
    'n': (120, 140, 110), 'N': (70, 86, 66),      # гуль — серо-зелёная кожа
    'u': (116, 72, 160), 'U': (66, 38, 96),       # культист / некромант — пурпур
    'o': (142, 112, 70), 'O': (88, 66, 38),       # огр — бурая кожа
    'z': (236, 232, 220), 'Z': (170, 164, 150),   # кость
    'i': (255, 138, 60), 'I': (170, 76, 24),      # подрывник — оранжевый, фитиль
    'l': (95, 211, 201), 'L': (40, 120, 112),     # кружащий стрелок — бирюза
    'j': (120, 220, 120),                         # некро-свечение
    'T': (214, 174, 60),                          # золото босса
    # пол
    'f': (52, 50, 56), 'F': (36, 34, 40), 'v': (66, 64, 72),
}

class Sprite:
    def __init__(self):
        self.px = {}
    def put(self, x, y, c):
        if 0 <= x < S and 0 <= y < S: self.px[(x, y)] = c
    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.put(x, y, c)
    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(int(cy - ry), int(cy + ry) + 1):
            for x in range(int(cx - rx), int(cx + rx) + 1):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1: self.put(x, y, c)
    def line(self, x0, y0, x1, y1, c, w=1):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
            for dx in range(w):
                for dy in range(w): self.put(x + dx, y + dy, c)
    def shade(self, pairs):
        """нижний-правый край формы темнеет: pairs = {светлый: тёмный}"""
        for (x, y), c in list(self.px.items()):
            if c in pairs and ((x + 1, y) not in self.px or (x, y + 1) not in self.px) and (x, y - 1) in self.px:
                self.px[(x, y)] = pairs[c]
    def outline(self):
        add = set()
        for (x, y) in self.px:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + dx, y + dy) not in self.px: add.add((x + dx, y + dy))
        for p in add:
            if 0 <= p[0] < S and 0 <= p[1] < S: self.px[p] = 'k'
    def image(self):
        im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        for (x, y), c in self.px.items(): im.putpixel((x, y), PAL[c] + (255,))
        return im

# ---------- герой: тёмный рыцарь — чёрный доспех, багровый плюмаж и плащ, алый визор, двуручный меч ----------
def hero(pose='idle', frame=0):
    s = Sprite()
    bob = 1 if (pose == 'walk' and frame % 2 == 1) else 0
    # плащ за спиной
    s.rect(10, 13 - bob, 22, 26 - bob, 'q'); s.rect(9, 16 - bob, 10, 24 - bob, 'q'); s.rect(22, 16 - bob, 23, 24 - bob, 'q')
    # ноги — латные
    lx, rx = (14, 18) if pose != 'walk' else ((13, 19) if frame % 2 == 0 else (15, 17))
    s.rect(lx - 1, 23, lx + 1, 28, 'a'); s.rect(rx - 1, 23, rx + 1, 28, 'a')
    s.rect(lx - 1, 27, lx + 1, 28, 'A'); s.rect(rx - 1, 27, rx + 1, 28, 'A')
    # торс — кираса с наплечниками
    s.rect(12, 14 - bob, 20, 23 - bob, 'a')
    s.rect(10, 13 - bob, 13, 16 - bob, 'g'); s.rect(19, 13 - bob, 22, 16 - bob, 'g')  # наплечники
    s.rect(16, 15 - bob, 16, 22 - bob, 'A')  # шов кирасы
    s.rect(13, 20 - bob, 19, 20 - bob, 'A'); s.put(16, 20 - bob, 'x')  # пояс с алым камнем
    # шлем
    s.rect(12, 6 - bob, 20, 13 - bob, 'a'); s.rect(13, 5 - bob, 19, 5 - bob, 'a')
    s.rect(12, 6 - bob, 20, 6 - bob, 'g'); s.rect(13, 5 - bob, 19, 5 - bob, 'g')  # блик на куполе
    s.rect(14, 9 - bob, 18, 10 - bob, 'A'); s.put(15, 9 - bob, 'x'); s.put(17, 9 - bob, 'x')  # щель визора и алые глаза
    # плюмаж
    s.rect(15, 1 - bob, 17, 5 - bob, 'q'); s.rect(16, 0 - bob, 16, 1 - bob, 'q'); s.put(18, 2 - bob, 'q'); s.put(19, 3 - bob, 'q')
    s.shade({'a': 'A', 'g': 'a', 'q': 'Q'})
    # двуручный меч
    if pose == 'attack':
        s.line(21, 20 - bob, 30, 6 - bob, 'd', 2); s.line(22, 20 - bob, 30, 7 - bob, 'w', 1)
        s.rect(19, 20 - bob, 23, 21 - bob, 'A'); s.put(21, 22 - bob, 'x')
        for (ax, ay) in ((30, 22), (31, 16), (31, 11), (28, 4)): s.put(ax, ay - bob, 'x')  # багровый след
    else:
        s.line(22, 8 - bob, 24, 26 - bob, 'd', 2); s.line(23, 9 - bob, 24, 25 - bob, 'w', 1)
        s.rect(20, 11 - bob, 25, 12 - bob, 'A'); s.put(22, 10 - bob, 'x')
    s.outline()
    return s


def legs(s, lx, rx, y0, y1, c, pose, frame, w=1):
    """две ноги; в шаге разъезжаются"""
    if pose == 'walk': lx, rx = (lx - 1, rx + 1) if frame % 2 == 0 else (lx + 1, rx - 1)
    s.rect(lx - w, y0, lx + w, y1, c); s.rect(rx - w, y0, rx + w, y1, c)

# ---------- гуль (Рвущийся): сгорбленный, длинные когти, алые глаза ----------
def rusher(pose='idle', frame=0):
    s = Sprite()
    bob = 1 if (pose == 'idle' and frame % 2) else 0
    legs(s, 13, 19, 23, 28, 'N', pose, frame)
    s.ellipse(16, 18 - bob, 7, 6, 'n'); s.rect(10, 18 - bob, 22, 22 - bob, 'n')  # горб
    s.ellipse(15, 11 - bob, 5, 5, 'n')  # голова наклонена вперёд
    s.rect(11, 13 - bob, 19, 14 - bob, 'N'); s.put(12, 13 - bob, 'z'); s.put(15, 13 - bob, 'z'); s.put(18, 13 - bob, 'z')  # пасть с зубами
    s.put(13, 10 - bob, 'x'); s.put(17, 10 - bob, 'x')
    for x in (12, 15, 18): s.put(x, 7 - bob, 'N')  # щетина
    # когти
    if pose == 'attack':
        s.line(21, 16, 29, 10, 'z', 1); s.line(21, 18, 29, 16, 'z', 1); s.line(21, 20, 28, 22, 'z', 1)
        s.rect(10, 13 - bob, 20, 15 - bob, 'N'); [s.put(x, 15 - bob, 'z') for x in (12, 16, 19)]
    else:
        s.line(21, 18 - bob, 25, 24 - bob, 'z', 1); s.line(7, 18 - bob, 9, 24 - bob, 'z', 1)
    s.shade({'n': 'N'}); s.outline()
    return s

# ---------- культист (Стрелок): пурпурный балахон, посох с огненным шаром ----------
def shooter(pose='idle', frame=0):
    s = Sprite()
    bob = 1 if (pose == 'idle' and frame % 2) else 0
    legs(s, 14, 18, 24, 28, 'U', pose, frame)
    s.rect(11, 14 - bob, 21, 24 - bob, 'u'); s.rect(10, 20 - bob, 22, 24 - bob, 'u')  # балахон расширяется книзу
    s.ellipse(16, 9 - bob, 5, 5, 'u'); s.rect(13, 9 - bob, 19, 11 - bob, 'A')  # капюшон, тень лица
    s.put(14, 10 - bob, 'p'); s.put(18, 10 - bob, 'p')
    s.rect(14, 15 - bob, 18, 15 - bob, 'T')  # цепочка
    if pose == 'attack':
        s.line(21, 15 - bob, 30, 15 - bob, 'O', 1); s.ellipse(29, 15 - bob, 2, 2, 'p'); s.put(29, 15 - bob, 'e')
    else:
        s.line(22, 8 - bob, 23, 26 - bob, 'O', 1); s.ellipse(22, 7 - bob, 2, 2, 'p'); s.put(22, 7 - bob, 'e')
    s.shade({'u': 'U'}); s.outline()
    return s

# ---------- огр (Молот): бурая туша, деревянный молот ----------
def tank(pose='idle', frame=0):
    s = Sprite()
    legs(s, 11, 21, 25, 29, 'O', pose, frame, w=2)
    s.ellipse(16, 17, 9, 9, 'o'); s.rect(7, 14, 25, 23, 'o')
    s.rect(9, 21, 23, 23, 'O')  # набедренная повязка
    s.ellipse(16, 8, 5, 4, 'o'); s.rect(13, 10, 19, 11, 'O'); s.put(14, 8, 'e'); s.put(18, 8, 'e'); s.put(13, 11, 'z'); s.put(19, 11, 'z')  # клыки
    if pose == 'attack':
        s.line(24, 18, 27, 4, 'O', 2); s.rect(22, 1, 31, 7, 'o'); s.rect(22, 1, 31, 2, 'O'); s.rect(23, 3, 30, 6, 'O')
    else:
        s.line(25, 14, 27, 24, 'O', 2); s.rect(24, 22, 31, 28, 'o'); s.rect(25, 24, 30, 27, 'O')
    s.shade({'o': 'O'}); s.outline()
    return s

# ---------- подрывник: гоблин с бочкой-бомбой и горящим фитилём ----------
def bomber(pose='idle', frame=0):
    s = Sprite()
    legs(s, 13, 19, 24, 28, 'N', pose, frame)
    s.ellipse(16, 20, 5, 5, 'n'); s.ellipse(16, 12, 4, 4, 'n'); s.put(14, 11, 'x'); s.put(18, 11, 'x')
    s.rect(13, 13, 19, 14, 'N'); s.put(15, 14, 'z'); s.put(18, 14, 'z')
    # бочка над головой
    s.rect(10, 2, 22, 9, 'O'); s.rect(10, 3, 22, 3, 'o'); s.rect(10, 8, 22, 8, 'o'); s.rect(16, 2, 16, 9, 'i')
    s.line(12, 9, 10, 23, 'N', 1); s.line(20, 9, 22, 23, 'N', 1)  # руки держат бочку
    # фитиль: в атаке горит ярче и короче
    if pose == 'attack':
        s.put(23, 1, 'I'); s.put(24, 0, 'e'); s.put(25, 0, 'i'); s.put(24, 1, 'i'); s.rect(9, 2, 23, 9, 'i'); s.rect(16, 2, 16, 9, 'e')
    else:
        s.line(22, 2, 25, 0, 'I', 1); s.put(25 if frame % 2 else 26, 0, 'e')
    s.shade({'n': 'N', 'o': 'O', 'i': 'I'}); s.outline()
    return s

# ---------- копейщик: скелет с длинным копьём ----------
def lancer(pose='idle', frame=0):
    s = Sprite()
    legs(s, 14, 18, 22, 28, 'Z', pose, frame)
    s.rect(13, 14, 19, 21, 'z'); [s.rect(13, y, 19, y, 'Z') for y in (16, 18, 20)]  # рёбра
    s.ellipse(16, 9, 4, 4, 'z'); s.rect(13, 9, 19, 10, 'A'); s.put(14, 9, 'x'); s.put(18, 9, 'x'); s.rect(14, 12, 18, 12, 'Z')
    lean = 3 if pose == 'attack' else 0
    if pose == 'attack':
        s.line(10, 17, 31, 17, 'O', 1); s.rect(28, 16, 31, 18, 'd'); s.put(31, 17, 'w')
    else:
        s.line(21, 2, 23, 28, 'O', 1); s.rect(20, 1, 22, 4, 'd'); s.put(21, 0, 'w')
    void = lean
    s.shade({'z': 'Z'}); s.outline()
    return s

# ---------- некромант (Призыватель): тёмный балахон, череп на посохе, зелёное свечение ----------
def summoner(pose='idle', frame=0):
    s = Sprite()
    bob = 1 if (pose == 'idle' and frame % 2) else 0
    s.rect(11, 13 - bob, 21, 27, 'U'); s.rect(9, 21 - bob, 23, 27, 'U')
    s.ellipse(16, 8 - bob, 5, 5, 'U'); s.rect(13, 8 - bob, 19, 10 - bob, 'A'); s.put(14, 9 - bob, 'j'); s.put(18, 9 - bob, 'j')
    s.rect(14, 15 - bob, 18, 15 - bob, 'j')
    if pose == 'attack':
        s.line(21, 14 - bob, 29, 10 - bob, 'O', 1); s.ellipse(29, 8 - bob, 2, 2, 'z'); s.put(28, 8 - bob, 'j'); s.put(30, 8 - bob, 'j')
        for (ax, ay) in ((26, 3), (31, 5), (24, 14), (31, 14)): s.put(ax, ay - bob, 'j')
    else:
        s.line(22, 7 - bob, 23, 27, 'O', 1); s.ellipse(22, 5 - bob, 2, 2, 'z'); s.put(21, 5 - bob, 'j'); s.put(23, 5 - bob, 'j')
    s.shade({'U': 'A'}); s.outline()
    return s

# ---------- щитоносец: скелет-латник с ростовым щитом ----------
def shield(pose='idle', frame=0):
    s = Sprite()
    legs(s, 13, 19, 23, 28, 'Z', pose, frame)
    s.rect(12, 12, 20, 22, 'a'); s.rect(10, 11, 13, 14, 'g'); s.rect(19, 11, 22, 14, 'g')
    s.ellipse(16, 7, 4, 4, 'z'); s.rect(13, 7, 19, 8, 'A'); s.put(14, 7, 'x'); s.put(18, 7, 'x'); s.rect(12, 3, 20, 4, 'a')  # шлем-обруч
    # щит — спереди, бирюзовый с умбоном
    sx = 4 if pose != 'attack' else 2
    s.rect(sx, 10, sx + 7, 26, 'l'); s.rect(sx + 1, 11, sx + 6, 25, 'L'); s.rect(sx + 2, 13, sx + 5, 23, 'l'); s.put(sx + 3, 18, 'd'); s.put(sx + 4, 18, 'd')
    if pose == 'attack':
        s.line(21, 16, 28, 22, 'd', 2); s.rect(20, 15, 22, 17, 'A')  # булава вниз
    else:
        s.line(22, 10, 24, 22, 'd', 1); s.ellipse(22, 9, 2, 2, 'A')
    s.shade({'a': 'A', 'z': 'Z', 'l': 'L'}); s.outline()
    return s

# ---------- кружащий стрелок: летающий глаз с перепончатыми крыльями ----------
def orbiter(pose='idle', frame=0):
    s = Sprite()
    up = frame % 2 == 0
    # крылья
    wy = 8 if up else 14
    s.line(9, wy, 3, wy - 4 if up else wy + 2, 'L', 2); s.line(9, wy + 2, 3, wy + 6 if up else wy + 8, 'L', 1); s.rect(3, wy - 4 if up else wy + 2, 9, wy + 6 if up else wy + 8, 'L')
    s.line(23, wy, 29, wy - 4 if up else wy + 2, 'L', 2); s.rect(23, wy - 4 if up else wy + 2, 29, wy + 6 if up else wy + 8, 'L')
    # глаз
    s.ellipse(16, 15, 7, 7, 'l'); s.ellipse(16, 15, 4, 4, 'z'); s.ellipse(17 if pose == 'attack' else 16, 15, 2, 2, 'A'); s.put(17, 14, 'w')
    s.rect(11, 9, 21, 9, 'L')  # веко
    for x in (12, 16, 20): s.put(x, 23, 'L'); s.put(x, 24, 'L')  # щупальца
    if pose == 'attack':
        for (ax, ay) in ((25, 13), (27, 15), (25, 17)): s.put(ax, ay, 'p'); s.put(ax + 1, ay, 'e')
    s.shade({'l': 'L'}); s.outline()
    return s

# ---------- босс «Молот Ковчега»: вождь огров в железном шлеме, золотой молот ----------
def boss(pose='idle', frame=0):
    s = Sprite()
    legs(s, 10, 22, 26, 31, 'O', pose, frame, w=2)
    s.ellipse(16, 17, 10, 10, 'o'); s.rect(6, 13, 26, 24, 'o')
    s.rect(6, 12, 11, 16, 'a'); s.rect(21, 12, 26, 16, 'a')  # железные наплечники
    s.rect(8, 22, 24, 24, 'A'); s.put(16, 23, 'T')  # пояс
    s.rect(12, 3, 20, 10, 'a'); s.rect(13, 2, 19, 2, 'a'); s.rect(11, 4, 11, 7, 'T'); s.rect(21, 4, 21, 7, 'T')  # шлем с золотыми рогами
    s.rect(13, 7, 19, 8, 'A'); s.put(14, 7, 'x'); s.put(18, 7, 'x'); s.put(13, 10, 'z'); s.put(19, 10, 'z')
    if pose == 'attack':
        s.line(24, 18, 27, 3, 'O', 2); s.rect(21, 0, 31, 6, 'T'); s.rect(22, 1, 30, 5, 'a'); s.rect(21, 5, 31, 6, 'A')
    else:
        s.line(26, 12, 28, 24, 'O', 2); s.rect(24, 22, 31, 29, 'T'); s.rect(25, 23, 30, 28, 'a')
    s.shade({'o': 'O', 'a': 'A'}); s.outline()
    return s

def floor_tile(variant=0):
    s = Sprite()
    s.rect(0, 0, 31, 31, 'f')
    # каменная кладка: два ряда плит со сдвигом
    s.rect(0, 15, 31, 15, 'F'); s.rect(0, 31, 31, 31, 'F')
    s.rect(15, 0, 15, 15, 'F'); s.rect(7, 16, 7, 31, 'F'); s.rect(23, 16, 23, 31, 'F')
    s.rect(0, 0, 31, 0, 'v'); s.rect(0, 16, 31, 16, 'v'); s.rect(16, 0, 16, 15, 'v'); s.rect(8, 16, 8, 31, 'v'); s.rect(24, 16, 24, 31, 'v')
    # трещины/камни
    cracks = [((6, 9), (12, 13)), ((20, 5), (24, 10)), ((9, 22), (17, 26))][variant % 3]
    s.line(cracks[0][0], cracks[0][1], cracks[1][0], cracks[1][1], 'F')
    for (x, y) in (((4, 26), (26, 18), (14, 3))[variant % 3],): s.put(x, y, 'v')
    for (x, y) in (((8, 4), (22, 14), (15, 29), (27, 26)), ((3, 12), (18, 20), (26, 3)), ((12, 9), (5, 20), (24, 28)))[variant % 3]: s.rect(x, y, x + 1, y, 'v')
    return s

def wall_tile(top=False):
    s = Sprite()
    s.rect(0, 0, 31, 31, 'F')
    for y in (0, 11, 22):
        s.rect(0, y, 31, y, 'A')
        off = 0 if (y // 11) % 2 == 0 else 8
        for x in range(off, 32, 16): s.rect(x, y + 1, x, y + 10, 'A')
    s.rect(0, 1, 31, 10, 'v' if top else 'f'); s.rect(0, 12, 31, 21, 'f'); s.rect(0, 23, 31, 31, 'f')
    for y in (0, 11, 22):
        s.rect(0, y, 31, y, 'A')
        off = 0 if (y // 11) % 2 == 0 else 8
        for x in range(off, 32, 16): s.rect(x, y + 1, x, y + 10, 'A')
    if top: s.rect(0, 0, 31, 1, 'v')
    return s

def pillar_tile():
    """колонна/стена внутри комнаты: каменный блок с подсветкой сверху"""
    s = Sprite()
    s.rect(0, 0, 31, 31, 'v'); s.rect(0, 0, 31, 3, 'd'); s.rect(0, 4, 31, 4, 'f')
    s.rect(2, 8, 29, 8, 'F'); s.rect(2, 16, 29, 16, 'F'); s.rect(2, 24, 29, 24, 'F')
    for y, off in ((9, 2), (17, 10), (25, 6)):
        for x in range(off, 30, 12): s.rect(x, y, x, y + 6, 'F')
    s.rect(0, 28, 31, 31, 'A'); s.rect(0, 0, 0, 31, 'A'); s.rect(31, 0, 31, 31, 'A')
    return s

def pit_tile():
    s = Sprite()
    s.rect(0, 0, 31, 31, 'k'); s.rect(0, 0, 31, 2, 'A'); s.rect(0, 0, 2, 31, 'A')
    s.rect(3, 3, 31, 31, 'k'); s.rect(28, 20, 31, 31, 'A'); s.rect(20, 28, 31, 31, 'A')
    return s

def torch(frame):
    s = Sprite()
    s.rect(15, 14, 16, 26, 'O'); s.rect(14, 13, 17, 14, 'A')
    if frame == 0: s.ellipse(16, 9, 3, 5, 'i'); s.ellipse(16, 10, 2, 3, 'e'); s.put(16, 5, 'i')
    else: s.ellipse(16, 10, 4, 4, 'i'); s.ellipse(16, 11, 2, 2, 'e'); s.put(14, 5, 'i'); s.put(18, 6, 'i')
    s.outline()
    return s

def particle(c, size=3):
    s = Sprite()
    s.rect(16 - size // 2, 16 - size // 2, 16 - size // 2 + size - 1, 16 - size // 2 + size - 1, c)
    return s

def bullet(kind):
    s = Sprite()
    if kind == 'enemy': s.ellipse(16, 16, 4, 4, 'p'); s.ellipse(16, 16, 2, 2, 'e')
    else: s.ellipse(16, 16, 3, 3, 'd'); s.put(16, 16, 'w')
    s.outline()
    return s

# ---------- иконки 16×16: символ + цвет; Руны и предметы ----------
def icon(symbol, c, c2=None):
    """символ на прозрачном фоне, контур авто; рисуется в левом верхнем квадрате 16×16 кадра 32"""
    s = Sprite()
    c2 = c2 or c
    P = s.put
    if symbol == 'flame':
        for y, w in ((3, 1), (4, 1), (5, 2), (6, 3), (7, 3), (8, 4), (9, 5), (10, 5), (11, 5), (12, 4), (13, 3)):
            for x in range(8 - w // 2, 8 - w // 2 + w): P(x, y, c)
        for y in (9, 10, 11, 12): P(8, y, c2)
    elif symbol == 'bolt':
        for (x, y) in ((9, 2), (8, 3), (8, 4), (7, 5), (7, 6), (6, 7), (9, 7), (8, 8), (8, 9), (7, 10), (7, 11), (6, 12), (6, 13)): P(x, y, c)
        for (x, y) in ((8, 5), (9, 8), (7, 9)): P(x, y, c2)
    elif symbol == 'shield':
        for y in range(3, 13):
            w = 10 if y < 9 else 10 - (y - 8) * 2
            for x in range(8 - w // 2, 8 - w // 2 + w): P(x, y, c)
        for y in range(4, 11): P(8, y, c2)
    elif symbol == 'drop':
        for y, w in ((3, 1), (4, 1), (5, 3), (6, 3), (7, 5), (8, 5), (9, 7), (10, 7), (11, 7), (12, 5), (13, 3)):
            for x in range(8 - w // 2, 8 - w // 2 + w): P(x, y, c)
        P(6, 9, c2); P(6, 10, c2)
    elif symbol == 'skull':
        s.ellipse(8, 7, 5, 4, c); s.rect(6, 10, 10, 13, c); P(6, 7, 'k'); P(10, 7, 'k'); P(7, 12, 'k'); P(9, 12, 'k')
    elif symbol == 'star':
        for (x, y) in ((8, 2), (8, 3), (7, 4), (9, 4), (3, 5), (4, 5), (5, 5), (6, 5), (7, 5), (8, 5), (9, 5), (10, 5), (11, 5), (12, 5), (13, 5), (6, 6), (10, 6), (6, 7), (10, 7), (5, 8), (11, 8), (5, 9), (8, 9), (11, 9), (4, 10), (7, 10), (9, 10), (12, 10), (4, 11), (12, 11)): P(x, y, c)
        P(8, 6, c2); P(8, 7, c2); P(8, 8, c2)
    elif symbol == 'ring':
        s.ellipse(8, 8, 6, 6, c); s.ellipse(8, 8, 3, 3, 'k'); P(8, 2, c2); P(8, 3, c2)
        for (x, y) in list(s.px.keys()):
            if s.px[(x, y)] == 'k': del s.px[(x, y)]
    elif symbol == 'arrow':
        for i in range(10): P(3 + i, 12 - i, c)
        for (x, y) in ((12, 3), (11, 3), (10, 3), (12, 4), (12, 5), (12, 6)): P(x, y, c2)
    elif symbol == 'spiral':
        for (x, y) in ((8, 8), (9, 8), (9, 7), (8, 6), (7, 6), (6, 7), (6, 9), (7, 10), (9, 10), (10, 10), (11, 9), (11, 7), (10, 5), (8, 4), (6, 4), (4, 6), (4, 9), (5, 11), (7, 12), (10, 12), (12, 11)): P(x, y, c)
    elif symbol == 'cross':
        s.rect(7, 2, 9, 13, c); s.rect(3, 6, 13, 8, c); s.rect(8, 3, 8, 12, c2)
    elif symbol == 'gem':
        for y, w in ((4, 6), (5, 8), (6, 10), (7, 10), (8, 8), (9, 6), (10, 4), (11, 2)):
            for x in range(8 - w // 2, 8 - w // 2 + w): P(x, y, c)
        s.rect(6, 5, 9, 5, c2)
    elif symbol == 'wave':
        for x in range(2, 14): P(x, 8 + round(2.2 * math.sin(x * 0.9)), c); P(x, 11 + round(2.2 * math.sin(x * 0.9)), c2)
    elif symbol == 'boot':
        s.rect(5, 2, 8, 9, c); s.rect(5, 9, 12, 12, c); s.rect(5, 12, 12, 12, c2)
    elif symbol == 'eye':
        for y, w in ((5, 4), (6, 8), (7, 12), (8, 12), (9, 8), (10, 4)):
            for x in range(8 - w // 2, 8 - w // 2 + w): P(x, y, c)
        s.ellipse(8, 7.5, 2, 2, c2); P(8, 7, 'k')
    elif symbol == 'sword':
        for i in range(9): P(4 + i, 12 - i, c)
        P(5, 11, c2); P(6, 10, c2)
        s.rect(3, 9, 7, 9, c2); s.rect(5, 11, 5, 13, c2); s.rect(3, 13, 5, 13, c2)
    elif symbol == 'heart':
        for y, w in ((4, 0), (5, 0), (6, 12), (7, 12), (8, 10), (9, 8), (10, 6), (11, 4), (12, 2)):
            for x in range(8 - w // 2, 8 - w // 2 + w): P(x, y, c)
        s.ellipse(5.5, 5, 3, 2, c); s.ellipse(10.5, 5, 3, 2, c); P(5, 5, c2); P(6, 6, c2)
    elif symbol == 'coin':
        s.ellipse(8, 8, 6, 6, c); s.ellipse(8, 8, 4, 4, c2); s.rect(8, 5, 8, 10, c)
    elif symbol == 'moon':
        s.ellipse(8, 8, 6, 6, c)
        for (x, y) in list(s.px.keys()):
            if (x - 10.5) ** 2 + (y - 7) ** 2 <= 25: del s.px[(x, y)]
    elif symbol == 'spike':
        for i in range(4): s.rect(2 + i * 4, 13 - i * 2 - 4, 2 + i * 4, 13, c); P(2 + i * 4, 13 - i * 2 - 5, c2)
    elif symbol == 'hourglass':
        for y, w in ((3, 10), (4, 8), (5, 6), (6, 4), (7, 2), (8, 2), (9, 4), (10, 6), (11, 8), (12, 10)):
            for x in range(8 - w // 2, 8 - w // 2 + w): P(x, y, c)
        s.rect(7, 11, 8, 12, c2)
    elif symbol == 'ghost':
        s.ellipse(8, 7, 5, 5, c); s.rect(3, 7, 12, 12, c); P(5, 13, c); P(8, 13, c); P(11, 13, c); P(6, 6, 'k'); P(10, 6, 'k')
    elif symbol == 'anchor':
        s.rect(7, 2, 8, 12, c); s.rect(4, 5, 11, 5, c); s.ellipse(8, 11, 5, 3, c); s.ellipse(8, 11, 3, 1, 'k')
        for (x, y) in list(s.px.keys()):
            if s.px[(x, y)] == 'k' and y < 12: del s.px[(x, y)]
        s.rect(7, 8, 8, 12, c2)
    elif symbol == 'hammer':
        s.rect(4, 3, 11, 7, c); s.rect(7, 7, 8, 13, c2); s.rect(4, 3, 11, 3, c2)
    s.outline()
    return s

RUNE_ICONS = {
    'ash_trail': ('flame', 'i', 'e'), 'second_wind': ('arrow', 'b', 'w'), 'ricochet': ('bolt', 'd', 'w'), 'greedy_shards': ('star', 'u', 'd'),
    'long_pull': ('spiral', 'u', 'u'), 'compression': ('ring', 'u', 'x'), 'wide_window': ('hourglass', 'b', 'w'), 'echo_answer': ('wave', 'b', 'w'),
    'loyalty': ('ghost', 'z', 'z'), 'twin': ('sword', 'd', 'w'), 'overload': ('bolt', 'b', 'w'), 'grounding': ('anchor', 'b', 'd'),
    'metronome': ('hourglass', 'q', 'x'), 'crescendo': ('drop', 'q', 'x'), 'spiked_barrier': ('spike', 'b', 'w'), 'instant_barrier': ('shield', 'b', 'w'),
    'poison_soil': ('drop', 'j', 'n'), 'roots': ('spike', 'n', 'j'), 'heaviness': ('hammer', 'd', 'A'), 'rift': ('bolt', 'T', 'e'),
    'reserve': ('boot', 'b', 'd'), 'shard_catcher': ('coin', 'T', 'e'), 'blood_on_blade': ('sword', 'q', 'x'), 'magnet': ('ring', 'd', 'w'),
    'echo_of_pain': ('heart', 'q', 'x'), 'silence': ('moon', 'u', 'u'), 'glass_fury': ('gem', 'x', 'w'), 'brittle_enemies': ('skull', 'z', 'z'),
    'shield_breaker': ('cross', 'd', 'w'), 'last_breath': ('heart', 'z', 'x'), 'thirst': ('drop', 'q', 'x'), 'breather': ('wave', 'j', 'n'),
}
ITEM_ICONS = {
    'jagged_blade': ('sword', 'd', 'w'), 'long_blade': ('sword', 'd', 'b'), 'reaper_blade': ('sword', 'q', 'x'), 'tide_hammer': ('hammer', 'b', 'w'), 'abyss_blade': ('sword', 'u', 'x'),
    'leather_armor': ('shield', 'o', 'O'), 'plate_armor': ('shield', 'd', 'w'), 'wanderer_armor': ('shield', 'n', 'j'), 'mirror_cuirass': ('shield', 'b', 'w'), 'ark_carapace': ('shield', 'T', 'e'),
    'wind_boots': ('boot', 'b', 'w'), 'deft_gloves': ('arrow', 'T', 'e'), 'shard_ring': ('ring', 'T', 'e'), 'pupil_amulet': ('gem', 'b', 'w'), 'double_step': ('boot', 'u', 'x'),
    'ash_ember': ('flame', 'i', 'e'), 'mirror_shard': ('gem', 'd', 'w'), 'abyss_heart': ('heart', 'q', 'x'), 'warden_eye': ('eye', 'T', 'e'), 'first_diver_seal': ('anchor', 'x', 'w'),
}

def boss_portrait():
    """портрет вождя огров крупно: шлем, рога, клыки"""
    s = Sprite()
    s.ellipse(16, 18, 12, 11, 'o'); s.rect(4, 16, 28, 29, 'o')
    s.rect(6, 4, 26, 15, 'a'); s.rect(8, 3, 24, 3, 'a'); s.rect(6, 4, 26, 5, 'g')
    s.rect(2, 6, 5, 12, 'T'); s.rect(27, 6, 30, 12, 'T'); s.put(2, 5, 'T'); s.put(30, 5, 'T')
    s.rect(8, 12, 24, 15, 'A'); s.rect(10, 13, 13, 14, 'x'); s.rect(19, 13, 22, 14, 'x')
    s.rect(9, 22, 23, 24, 'O'); s.rect(8, 20, 9, 24, 'z'); s.rect(23, 20, 24, 24, 'z')
    s.shade({'o': 'O', 'a': 'A'}); s.outline()
    return s

CHARS = {'hero': hero, 'rusher': rusher, 'shooter': shooter, 'tank': tank, 'bomber': bomber, 'lancer': lancer, 'summoner': summoner, 'shield': shield, 'orbiter': orbiter, 'boss_hammer': boss}
POSES = [('idle0', 'idle', 0), ('idle1', 'idle', 1), ('walk0', 'walk', 0), ('walk1', 'walk', 1), ('attack', 'attack', 0)]

SPRITES = {}
for cid, fn in CHARS.items():
    for name, pose, fr in POSES: SPRITES[f'{cid}_{name}'] = fn(pose, fr)
for k, (sym, c, c2) in RUNE_ICONS.items(): SPRITES['rune_' + k] = icon(sym, c, c2)
for k, (sym, c, c2) in ITEM_ICONS.items(): SPRITES['item_' + k] = icon(sym, c, c2)
SPRITES.update({'floor0': floor_tile(0), 'floor1': floor_tile(1), 'floor2': floor_tile(2), 'wall': wall_tile(False), 'wall_top': wall_tile(True), 'bullet_enemy': bullet('enemy'), 'bullet_player': bullet('player'),
                'pillar': pillar_tile(), 'pit': pit_tile(), 'torch0': torch(0), 'torch1': torch(1),
                'portrait_boss_hammer': boss_portrait(),
                'p_blood': particle('R'), 'p_ichor': particle('n'), 'p_bone': particle('z', 2), 'p_spark': particle('e', 2), 'p_fire': particle('i'), 'p_magic': particle('u'), 'p_steel': particle('d', 2), 'p_crimson': particle('q', 2)})
_UNUSED = {
    'hero_idle': hero('idle'), 'hero_walk0': hero('walk', 0), 'hero_walk1': hero('walk', 1), 'hero_attack': hero('attack'),
    'rusher_idle': rusher('idle'), 'rusher_walk0': rusher('walk', 0), 'rusher_walk1': rusher('walk', 1), 'rusher_attack': rusher('attack'),
    'tank_idle': tank('idle'), 'tank_attack': tank('attack'),
    'shooter_idle': shooter('idle'), 'shooter_attack': shooter('attack'),
}

def preview(path, scale=4):
    names = list(CHARS.keys())
    cols = len(POSES)
    cw, ch = S * scale + 12, S * scale + 24
    im = Image.new('RGBA', (cw * cols + 12, ch * (len(names) + 1) + 12), (22, 26, 35, 255))
    d = ImageDraw.Draw(im)
    for r, cid in enumerate(names):
        for c, (pname, _, _) in enumerate(POSES):
            x, y = 12 + c * cw, 12 + r * ch
            im.paste(SPRITES['floor%d' % ((r + c) % 3)].image().resize((S * scale, S * scale), Image.NEAREST), (x, y))
            im.alpha_composite(SPRITES[f'{cid}_{pname}'].image().resize((S * scale, S * scale), Image.NEAREST), (x, y))
            d.text((x, y + S * scale + 2), f'{cid}_{pname}', fill=(201, 194, 176, 255))
    for c, key in enumerate(['floor0', 'pillar', 'pit', 'wall_top', 'portrait_boss_hammer']):
        x, y = 12 + c * cw, 12 + len(names) * ch
        im.alpha_composite(SPRITES[key].image().resize((S * scale, S * scale), Image.NEAREST), (x, y))
        d.text((x, y + S * scale + 2), key, fill=(201, 194, 176, 255))
    im.save(path)

def preview_icons(path, scale=4):
    keys = [k for k in SPRITES if k.startswith(('rune_', 'item_'))]
    cols = 13
    cw, ch = 16 * scale + 8, 16 * scale + 22
    im = Image.new('RGBA', (cw * cols + 8, ch * ((len(keys) + cols - 1) // cols) + 8), (27, 23, 29, 255))
    d = ImageDraw.Draw(im)
    for i, k in enumerate(keys):
        x, y = 8 + (i % cols) * cw, 8 + (i // cols) * ch
        im.alpha_composite(SPRITES[k].image().crop((0, 0, 16, 16)).resize((16 * scale, 16 * scale), Image.NEAREST), (x, y))
        d.text((x, y + 16 * scale + 2), k.split('_', 1)[1][:11], fill=(201, 194, 176, 255))
    im.save(path)

def atlas(png_path, json_path, cols=8):
    import json
    names = list(SPRITES.keys())
    rows = (len(names) + cols - 1) // cols
    im = Image.new('RGBA', (cols * S, rows * S), (0, 0, 0, 0))
    frames = {}
    for i, name in enumerate(names):
        x, y = (i % cols) * S, (i // cols) * S
        im.alpha_composite(SPRITES[name].image(), (x, y))
        fw = 16 if name.startswith(('rune_', 'item_')) else S
        frames[name] = {'frame': {'x': x, 'y': y, 'w': fw, 'h': fw}, 'rotated': False, 'trimmed': False,
                        'spriteSourceSize': {'x': 0, 'y': 0, 'w': fw, 'h': fw}, 'sourceSize': {'w': fw, 'h': fw}}
    im.save(png_path)
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({'frames': frames, 'meta': {'image': 'atlas.png', 'size': {'w': im.width, 'h': im.height}, 'scale': '1', 'generator': 'tools/sprites/gen.py'}}, f, ensure_ascii=False, indent=1)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    preview(os.path.join(OUT, 'preview.png'))
    preview_icons(os.path.join(OUT, 'preview-icons.png'))
    atlas(os.path.join(OUT, 'atlas.png'), os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'atlas.json'))
    import shutil; shutil.copy(os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'atlas.json'), os.path.join(OUT, 'atlas.json'))
    print('ok', len(SPRITES))
