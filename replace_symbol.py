import cv2
import numpy as np

from pykeyboard import PyKeyboard # from pyuserinput
keyboard = PyKeyboard()

def pick_color():
    picked_color = 0
    windowname = "Pick a color"

    def mouse_callback(event, x, y, flags, frame):
        if event == cv2.EVENT_LBUTTONUP:
            # print("Mouse-callback called")
            nonlocal picked_color 
            picked_color = frame[y,x]
            cv2.destroyWindow(windowname)
            keyboard.press_key('a')
            keyboard.release_key('a')

    all_colors = np.array(
        np.repeat(
            np.array([
                np.array([h, 255, 255], dtype=np.uint8) for h in range(0,180)
            ])[:,np.newaxis,:]
            ,repeats=100, axis=1
        )
    )

    all_colors = cv2.cvtColor(all_colors, cv2.COLOR_HSV2BGR)
    cv2.imshow(windowname, all_colors)

    cv2.setMouseCallback(windowname, mouse_callback, all_colors)
    cv2.waitKey(0)

    return picked_color

in_file = "modified_image.png"
out_file = "modified_image_2.png"

img_color = cv2.imread(in_file)
img = cv2.cvtColor(img_color, cv2.COLOR_BGR2GRAY)

# Select Symbol
winname_select = "Select symbol"
x,y,w,h = cv2.selectROI(winname_select, img, showCrosshair=False)
symbol = img[y:y+h, x:x+w]
cv2.destroyWindow(winname_select)

print("Performing template matching")

result = cv2.matchTemplate(img, symbol, method=cv2.TM_SQDIFF)

cv2.normalize( result, result, 0, 1, cv2.NORM_MINMAX, -1 )
# cv2.imshow("Res", result)
# cv2.waitKey(0)

locations = np.argwhere(result < 0.1)

draw_img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
for y,x in locations:
    cv2.rectangle(draw_img, (x,y), (x+w, y+h), (0,255,0), 2, 8, 0 )

cv2.imshow("Overview", cv2.resize(draw_img, None, None, 0.3, 0.3))

cv2.imshow("Selected Symbol", cv2.resize(symbol, None, None, 3, 3))
cv2.waitKey(1)

color = pick_color()

out_img = img_color
alpha = 0.5 

for y,x in locations:
    out_img[y:y+h, x:x+w] = out_img[y:y+h, x:x+w] * (1-alpha) + color * alpha
    # cv2.rectangle(out_img, (y,x), (y + symbol.shape[0], x + symbol.shape[1]), (0,255,0), 2, 8, 0 )

cv2.imshow("Final image", cv2.resize(out_img, None, None, 0.3, 0.3))
cv2.waitKey(0)

cv2.imwrite(out_file, out_img)