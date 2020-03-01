"use_strict";

const imgElement = document.getElementById('imageSrc');
const inputElement = document.getElementById('fileInput');
const canvas = document.getElementById('mainCanvas');
const patchCanvas = document.getElementById('patchCanvas');
const roiButton = document.getElementById('selectROIButton')

let img;
let template;
let state = "init";

let roiSelected = false;
let rect;
let refresh = false;
let dragging = false;
let origPoint;
let processed = false;
let threshold = 0.1;
let matches = [];

function onOpenCvReady() {
  cv['onRuntimeInitialized']=()=>{
    console.log("OpenCV loaded");
    rect = new cv.Rect(0, 0, 0, 0);
    origPoint = new cv.Point(0,0);
    img = new cv.Mat();
    template = new cv.Mat();
  };
}

function findMatches()
{
  let heatmap = cv.Mat.zeros(img.rows, img.cols, cv.CV_32F);;
  let mask = new cv.Mat();
  cv.matchTemplate(img, template, heatmap, cv.TM_SQDIFF, mask);

  cv.normalize( heatmap, heatmap, 0, 1, cv.NORM_MINMAX, -1 );
  // Since there is no "cv.findNonZero" in cv.js, we just go through the heatmap
  // and find our points ourselves...
  matches = [];
  for(let row = 0; row < heatmap.rows; row++)
  {
    for(let col = 0; col < heatmap.cols; col++)
    {
      let value = heatmap.floatAt(row, col);
      if(value < threshold)
      {
        matches.push({
          x: col,
          y: row
        })
      }
    }
  }

  heatmap.delete();
  mask.delete();

  processed = true;
  refresh = true;

  return matches;
}

function updateState(state)
{
  if(state == "init")
  {
    roiButton.style.display = "none";
    processed = false;
  }
  else if(state == "loaded" || state == "roiselected")
  {
    canvas.style.cursor = 'auto';
    document.body.style.backgroundColor = 'white';
    roiButton.style.display = "inline-block";
    roiButton.innerHTML = "Select New Patch";
    roiButton.removeAttribute("disabled");

    if(state == "roiselected" && processed == false)
    {
      findMatches();
      processed = true;
      refresh = true;
    }
  }
  else if(state == "selectroi")
  {
    processed = false;
    canvas.style.cursor = 'crosshair';
    document.body.style.backgroundColor = '#eee';
    roiButton.style.display = "inline-block";
    roiButton.setAttribute("disabled", "true");
    roiButton.innerHTML = "Select New Patch";
  }
}

inputElement.addEventListener('change', (e) => {
  imgElement.src = URL.createObjectURL(e.target.files[0]);
}, false);

imgElement.onload = function() {
  img = cv.imread(imgElement);
  refresh = true;
  state = "selectroi";
};

roiButton.addEventListener('click', (e) => {
  if(state == "selectroi")
  {
    state = "loaded";
  }
  else if(state == "loaded" || state == "roiselected")
  {
    state = "selectroi";
  }
}, false);

function draw() {
  let displayImage;
  try
  {
    displayImage = img.clone();
  }
  catch(e)
  {
    return;
  }

  if(state == "loaded")
  {
    cv.imshow(canvas, displayImage);
  }
  else if(state == "selectroi")
  {
    if(dragging)
    {
      let color = new cv.Scalar(255, 0, 0, 255);
      let point1 = new cv.Point(rect.x, rect.y);
      let point2 = new cv.Point(rect.x + rect.width, rect.y + rect.height);

      cv.rectangle(displayImage, point1, point2, color, 2, cv.LINE_8, 0);

      try
      {
        cv.imshow(patchCanvas, template);
      }
      catch(e)
      {
        console.log(e);
      }
    }

    try
    {
      cv.imshow(canvas, displayImage);
    }
    catch(e)
    {
      console.log(e);
    }
  }
  else if(state == "roiselected" && processed)
  {
    // Draw boxes at match-locations
    let color = new cv.Scalar(0, 255, 0, 255);
    if(matches.length > 0)
    {
      matches.forEach(function(item, index, array)
      {      
        let point1 = new cv.Point(item.x, item.y);
        let point2 = new cv.Point(item.x + template.cols, item.y + template.rows);

        cv.rectangle(displayImage, point1, point2, color, 2, cv.LINE_8, 0);
      });
    }

    try
    {
      cv.imshow(canvas, displayImage);
    }
    catch(e)
    {
      console.log(e);
    }
  }

  displayImage.delete();
}

requestAnimationFrame(mainLoop);
function mainLoop() {
  updateState(state);
  if (refresh) {
      refresh = false;
      draw();
  }
  requestAnimationFrame(mainLoop);
}

// Add Mouse-Listeners to document for dragging ROI
"down,up,move".split(",").forEach(name => document.addEventListener("mouse" + name, (event) => {

  if(state == "selectroi")
  {
    let bounds = canvas.getBoundingClientRect();
    let x = event.pageX - bounds.left - scrollX;
    let y = event.pageY - bounds.top - scrollY;

    if(x < 0 || y < 0 || x >= bounds.right - bounds.left || y >= bounds.bottom - bounds.top)
    {
      return;
    }

    if(event.type == "mousedown")
    {
      dragging = true;
      rect.x = x;
      rect.y = y;
      rect.width = 0;
      rect.height = 0;
      origPoint.x = x;
      origPoint.y = y;
      refresh = true;
    }
    else if(event.type == "mouseup")
    {
      dragging = false;
      state = "roiselected";
    }
    else if(event.type == "mousemove")
    {
      if(dragging)
      {     
        let scaleX = img.cols / (bounds.right - bounds.left);
        let scaleY = img.rows / (bounds.bottom - bounds.top);

        rect.x = x < origPoint.x ? x : origPoint.x;
        rect.y = y < origPoint.y ? y : origPoint.y;

        rect.width = Math.abs(origPoint.x - x);
        rect.height = Math.abs(origPoint.y - y);

        rect.x *= scaleX;
        rect.y *= scaleY;
        rect.width *= scaleX;
        rect.height *= scaleY;

        template = img.roi(rect);

        refresh = true;
      }
    }

  }

}));
