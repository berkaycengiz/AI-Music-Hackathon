"""Optional labeled grid beside an unmodified image preview and color palette."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from .image_analysis import load_grid_image


def save_debug_image(image_path, features, output_path):
    rgb, _ = load_grid_image(image_path)
    original = Image.fromarray(rgb).crop((0, 0, *features.source_size))
    grid = Image.fromarray(rgb)
    width = 640
    height = max(160, min(800, round(width*grid.height/grid.width)))
    original.thumbnail((width, height))
    grid = grid.resize((width, height))
    result = Image.new('RGB', (1312, height+400), '#eeeeee')
    draw = ImageDraw.Draw(result)
    draw.text((16, 12), 'Original image', fill='black')
    draw.text((672, 12), '4 x 4 pad (row-major numbering)', fill='black')
    result.paste(original, (16, 40))
    result.paste(grid, (672, 40))
    for i in range(16):
        row, col = divmod(i, 4)
        x, y = 672+col*160, 40+row*height//4
        draw.rectangle((x, y, x+159, 40+(row+1)*height//4-1), outline='white', width=2)
        draw.rectangle((x+4, y+4, x+31, y+24), fill='black')
        draw.text((x+8, y+7), str(i), fill='white')
        px, py = 16+col*324, height+65+row*78
        draw.text((px, py), f'Square {i}', fill='black')
        for j, color in enumerate(features.squares[i].dominant_colors):
            sx = px+j*100
            draw.rectangle((sx, py+18, sx+90, py+40), fill=color.rgb, outline='black')
            draw.text((sx, py+44), f'{color.weight:.0%}', fill='black')
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path)
    return output_path
