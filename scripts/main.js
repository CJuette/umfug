"use_strict";

const imgElement = document.getElementById('imageSrc');
const inputElement = document.getElementById('fileInput');
const canvas = document.getElementById('mainCanvas');
const patchCanvas = document.getElementById('patchCanvas');
const processedCanvas = document.getElementById('processedCanvas');
const roiButton = document.getElementById('selectROIButton');
const colorPicker = document.getElementById('colorPicker');
const opacitySlider = document.getElementById('opacitySlider');

let img;
let processedImage;
let template;
let state = "init";

let roiSelected = false;
let rect;
let refresh = false;
let dragging = false;
let origPoint;
let processed = false;
let matchesFound = false;
let threshold = 0.08;
let matches = [];

function onOpenCvReady() {
  cv['onRuntimeInitialized']=()=>{
    console.log("OpenCV loaded");
    rect = new cv.Rect(0, 0, 0, 0);
    origPoint = new cv.Point(0,0);
    img = new cv.Mat();
    template = new cv.Mat();
    processedImage = new cv.Mat();
  };
}

function iou(x1, y1, x2, y2, w, h)
{
  // Calculate IoU for two boxes with same width and height, 
  // just different location
  let inter = {
    x1: Math.max(x1, x2),
    y1: Math.max(y1, y2),
    x2: Math.min(x1 + w, x2 + w),
    y2: Math.min(y1 + h, y2 + h)
  };

  let interArea = Math.max(0, inter.x2 - inter.x1) * Math.max(0, inter.y2 - inter.y1);
  let boxArea = w*h;

  let iou = interArea / (2*boxArea - interArea);

  return iou;
}

let iouThreshold = 0.7;

function combineMatches(matches)
{
  // Combine overlapping matches to a single one
  // Measure overlap by IoU, combine matches with IoU of > 0.7

  let w = template.cols;
  let h = template.rows;

  // List of lists of dicts
  // [ [pt1, pt2], [pt3], [pt4, pt5] ] where pt1 and pt2 belong to each other etc.
  let groups = [];

  for(let item of matches)
  {
    let foundMatch = false;
    for(let combinedList of groups)
    {
      for(let cItem of combinedList)
      {
        if(iou(item.x, item.y, cItem.x, cItem.y, w, h) > iouThreshold)
        {
          combinedList.push(item);
          foundMatch = true;
          break;
        }
      }
      
      if(foundMatch)
      {
        break;
      }

    }

    if(!foundMatch)
    {
      groups.push([item]);
    }
  }

  let combinedMatches = [];

  for(let group of groups)
  {
    let sumX = 0;
    let sumY = 0;

    for(let item of group)
    {
      sumX += item.x;
      sumY += item.y;
    }

    combinedMatches.push({
      x: Math.floor(sumX / group.length),
      y: Math.floor(sumY / group.length)
    });
  }

  return combinedMatches;
}

function processImage()
{
  // Do all the replacing and stuff depending on the options
  // For now only coloring, but maybe other stuff in the future

  let opacity = parseInt(opacitySlider.value) / 100.0;
  let colorString = colorPicker.value;
  // parse the color-value to RGB
  let color = new cv.Scalar(
    parseInt(colorString.slice(1,3), 16),
    parseInt(colorString.slice(3,5), 16),
    parseInt(colorString.slice(5,7), 16),
    255
  );

  processedImage = img.clone();

  if(matches.length > 0)
  {
    for(let match of matches)
    {      
      let point1 = new cv.Point(match.x, match.y);
      let point2 = new cv.Point(match.x + template.cols, match.y + template.rows);

      // Draw everything over manually
      for(let row = point1.y; row <= point2.y; row++)
      {
        for(let col = point1.x; col <= point2.x; col++)
        {
          let pixel = processedImage.ucharPtr(row, col);
          for(let c = 0; c < 4; c++)
          {
            pixel[c] = Math.floor(pixel[c] * (1.0 - opacity) + color[c] * opacity);
          }
        }
      }

      // try
      // {
      //   cv.rectangle(processedOverlay, point1, point2, color, cv.FILLED, cv.LINE_8, 0);
      // }
      // catch(e)
      // {
      //   console.log(e);
      // }
    }
  }

  // try
  // {
  //   cv.addWeighted(img, 1.0 - opacity, processedOverlay, opacity, 0.0, processedImage);
  // }
  // catch(e)
  // {
  //   console.log(e);
  // }
}

function findMatches()
{
  let heatmap = cv.Mat.zeros(img.rows, img.cols, cv.CV_32F);
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

  matches = combineMatches(matches);

  heatmap.delete();
  mask.delete();

  refresh = true;

  return matches;
}

function updateState(state)
{
  if(state == "init")
  {
    processed = false;
    matchesFound = false;
  }
  else if(state == "loaded" || state == "roiselected")
  {
    document.body.style.backgroundColor = 'white';

    if(state == "roiselected")
    {
      if(matchesFound == false)
      {
        //TODO: Add buffering-overlay
        findMatches();
        matchesFound = true;
        refresh = true;
      }

      if(processed == false)
      {
        processImage();
        processed = true;
        refresh = true;
      }
    }
      
  }
  else if(state == "selectroi")
  {
    processed = false;
    matchesFound = false;
    document.body.style.backgroundColor = '#eee';
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

colorPicker.addEventListener('change', (e) => {
  processed = false;
  updateState();
}, false);

opacitySlider.addEventListener('input', (e) => {
  processed = false;
  updateState();
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
  else if(state == "roiselected")
  {
    if(matchesFound)
    {
      // Draw boxes at match-locations
      let color = new cv.Scalar(0, 255, 0, 255);
      if(matches.length > 0)
      {
        matches.forEach((item, index, array) =>
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

    if(processed)
    {
      try
      {
        cv.imshow(processedCanvas, processedImage);
      }
      catch(e)
      {
        console.log(e);
      }
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

  let bounds = canvas.getBoundingClientRect();
  let x = event.pageX - bounds.left - scrollX;
  let y = event.pageY - bounds.top - scrollY;

  // Check if inside canvas
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
    state = "selectroi";

    return;
  }

  if(state == "selectroi")
  {

    if(event.type == "mouseup")
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
