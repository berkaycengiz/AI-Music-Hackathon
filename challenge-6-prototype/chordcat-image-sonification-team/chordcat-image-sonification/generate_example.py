"""Generate a synthetic test chart (no external images or services required)."""
from pathlib import Path
from PIL import Image, ImageDraw


def main():
    destination = Path(__file__).parent/'examples'
    destination.mkdir(exist_ok=True)
    img = Image.new('RGB', (640, 640))
    draw = ImageDraw.Draw(img)
    colors = ['#db4545', '#e89736', '#eed65c', '#5cbd70', '#45bdbd', '#456ccc', '#9456bc', '#b95a94',
              '#753b35', '#9b702d', '#a6a55c', '#34694f', '#b4dedb', '#94b5e1', '#b3a4d5', '#dddddd']
    for i, color in enumerate(colors):
        row, col = divmod(i, 4)
        x, y = col*160, row*160
        draw.rectangle((x, y, x+159, y+159), fill=color)
        if row == 1:
            for offset in (25, 60, 95):
                draw.arc((x+10, y+offset-15, x+150, y+offset+45), 180, 350, fill='#f3e8cd', width=5)
        elif row == 2:
            for offset in (15, 60, 105):
                draw.line([(x+10, y+offset+25), (x+40, y+offset), (x+70, y+offset+30),
                           (x+100, y+offset), (x+150, y+offset+25)], fill='#f4dfb2', width=4)
        elif row == 3:
            for offset in range(10, 150, 16):
                draw.line((x+offset, y+8, x+offset, y+152), fill='#314357', width=2)
                draw.line((x+8, y+offset, x+152, y+offset), fill='#314357', width=2)
    img.save(destination/'sample.png')


if __name__ == '__main__':
    main()
