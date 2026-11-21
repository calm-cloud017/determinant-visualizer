/*全局状态层*/


let spacing = 40;       //网格间距
let vecA = { angle: 0, length: 2 };        //向量A
let vecB = { angle: 90, length: 2 };       //向量B

let quadUV = [          //演示四边形
  { u: 2, v: 1 },
  { u: 4, v: 1 },
  { u: 5, v: 3 },
  { u: 3, v: 3 }
];
let showQuad = false;   // 是否显示演示四边形
let quadButton;         // 按钮对象
/*数学计算层*/


//极坐标转笛卡尔坐标
function polarToCartesian(angleDeg, length) {
  let rad = radians(angleDeg); // p5 提供的角度转弧度函数
  return {
    x: length * cos(rad),
    y: length * sin(rad)
  };
}

//数学坐标转屏幕坐标
function mathToScreen(mathX, mathY) {
  let centerX = Math.round(width / 2 / spacing) * spacing;
  let centerY = Math.round(height / 2 / spacing) * spacing;
  
  return {
    x: centerX + mathX * spacing,       // 屏幕X = 中心点 + 数学X * 缩放比例
    y: centerY - mathY * spacing        // 屏幕Y = 中心点 - 数学Y * 缩放比例 (屏幕Y轴朝下所以是减号)
  };
}
// 屏幕坐标转数学坐标
function screenToMath(screenX, screenY) {
  let centerX = Math.round(width / 2 / 40) * 40;
  let centerY = Math.round(height / 2 / 40) * 40;
  return {
    x: (screenX - centerX) / 40,
    y: -(screenY - centerY) / 40
  };
}

// 计算二维向量的行列式；x1y2-x2y1
function computeDeterminant(x1, y1, x2, y2) {
  return x1 * y2 - x2 * y1;
}

// 计算两个向量夹角角度
function computeAngleBetween(x1, y1, x2, y2) {
  // 1. 计算点乘
  let dot = x1 * x2 + y1 * y2;
  
  // 2. 计算两个向量的模长
  let mag1 = Math.sqrt(x1 * x1 + y1 * y1);
  let mag2 = Math.sqrt(x2 * x2 + y2 * y2);
  
  // 防错处理：如果有一个向量长度为 0，夹角无意义，返回 0
  if (mag1 === 0 || mag2 === 0) return 0;
  
  // 3. 计算余弦值，并用 Math.max/min 限制在 [-1, 1] 之间防止浮点数误差报错
  let cosTheta = dot / (mag1 * mag2);
  cosTheta = Math.max(-1, Math.min(1, cosTheta));
  
  // 4. 用反余弦求弧度，再转成角度
  let radians = Math.acos(cosTheta);
  return degrees(radians);
}

//计算向量平行四边形面积；absinθ
function computeParallelogramArea(x1, y1, x2, y2) {
  let dot = x1 * x2 + y1 * y2;

  let mag1 = Math.sqrt(x1 * x1 + y1 * y1);
  let mag2 = Math.sqrt(x2 * x2 + y2 * y2);

  if (mag1 === 0 || mag2 === 0) return 0;
  let cosTheta = dot / (mag1 * mag2);
  cosTheta = Math.max(-1, Math.min(1, cosTheta));
  
  let radians = Math.acos(cosTheta);
  return mag1*mag2*Math.sin(radians)
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    let j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}


/*绘图层*/


//平面直角坐标系网格
function drawGrid() {
  let centerX = Math.round(width / 2 / spacing) * spacing;
  let centerY = Math.round(height / 2 / spacing) * spacing;

  //绘制网格线
  stroke(0,70,100); 
  strokeWeight(0.8);
  
  for (let x = centerX; x <= width; x += spacing) line(x, 0, x, height);
  for (let x = centerX - spacing; x >= 0; x -= spacing) line(x, 0, x, height);
  for (let y = centerY; y <= height; y += spacing) line(0, y, width, y);
  for (let y = centerY - spacing; y >= 0; y -= spacing) line(0, y, width, y);

  //绘制原点
  noStroke();
  fill(255, 255, 255, 50);
  circle(centerX, centerY, 12);
  fill(255);
  circle(centerX, centerY, 6);
}

//线性变换的几何直观体现
function drawDynamicGrid(mathA, mathB) {
  push();
  
  // 1. 算出屏幕四个角在“数学坐标系”中的坐标
  let topLeft = screenToMath(0, 0);
  let bottomRight = screenToMath(width, height);
  
  // 2. 算出在当前变换下，需要多少个网格才能覆盖屏幕
  // 为了防止向量共线（坍缩成一条线）导致除以 0 或者无穷大，我们加一个绝对值的保护
  // 我们在 X 方向和 Y 方向各找 4 个极端点，看它们的数学坐标范围
  let corners = [
    screenToMath(0, 0), screenToMath(width, 0), 
    screenToMath(0, height), screenToMath(width, height)
  ];
  
  // 找屏幕四角投影到向量 A 和 B 方向上的最大最小值
  let maxX = -Infinity, minX = Infinity, maxY = -Infinity, minY = Infinity;
  
  // 矩阵求逆（2D）：如果 A 是 (x1, y1)，B 是 (x2, y2)，逆矩阵是 1/det * [y2, -x2, -y1, x1]
  let det = mathA.x * mathB.y - mathA.y * mathB.x;
  
  if (Math.abs(det) > 0.00001) { // 当没有坍缩时，计算覆盖范围
    let invDet = 1 / det;
    for (let p of corners) {
      let u = (p.x * mathB.y - p.y * mathB.x) * invDet; 
      let v = (-p.x * mathA.y + p.y * mathA.x) * invDet;
      
      maxX = Math.max(maxX, u); minX = Math.min(minX, u);
      maxY = Math.max(maxY, v); minY = Math.min(minY, v);
    }
  } else {
    // 如果坍缩了，给一个巨大的默认值防止死循环
    maxX = 50; minX = -50; maxY = 50; minY = -50;
  }

  // 给范围向外扩大 2 格，确保边缘被彻底盖住
  let startU = Math.floor(minX) - 2;
  let endU = Math.ceil(maxX) + 2;
  let startV = Math.floor(minY) - 2;
  let endV = Math.ceil(maxY) + 2;

  // 3. 画极淡的底层标准网格（用像素直接画，不需要循环矩阵）
  let baseSpacing = 40;
  let centerX = Math.round(width / 2 / baseSpacing) * baseSpacing;
  let centerY = Math.round(height / 2 / baseSpacing) * baseSpacing;
  
  push();
  stroke(26, 58, 82, 40); // 极度透明
  strokeWeight(1);
  for (let x = centerX; x <= width; x += baseSpacing) line(x, 0, x, height);
  for (let x = centerX - baseSpacing; x >= 0; x -= baseSpacing) line(x, 0, x, height);
  for (let y = centerY; y <= height; y += baseSpacing) line(0, y, width, y);
  for (let y = centerY - baseSpacing; y >= 0; y -= baseSpacing) line(0, y, width, y);
  pop();

  // 4. 画动态变换后的网格
  stroke(26, 150, 220); 
  strokeWeight(1.5);
  
  // 画与 B 平行的线 (u 为常数)
  for (let u = startU; u <= endU; u++) {
    let p1Math = { x: u * mathA.x + startV * mathB.x, y: u * mathA.y + startV * mathB.y };
    let p2Math = { x: u * mathA.x + endV * mathB.x, y: u * mathA.y + endV * mathB.y };
    let p1 = mathToScreen(p1Math.x, p1Math.y);
    let p2 = mathToScreen(p2Math.x, p2Math.y);
    line(p1.x, p1.y, p2.x, p2.y);
  }
  
  // 画与 A 平行的线 (v 为常数)
  for (let v = startV; v <= endV; v++) {
    let p1Math = { x: startU * mathA.x + v * mathB.x, y: startU * mathA.y + v * mathB.y };
    let p2Math = { x: endU * mathA.x + v * mathB.x, y: endU * mathA.y + v * mathB.y };
    let p1 = mathToScreen(p1Math.x, p1Math.y);
    let p2 = mathToScreen(p2Math.x, p2Math.y);
    line(p1.x, p1.y, p2.x, p2.y);
  }

  // 5. 重新画坐标轴
  stroke(255);
  strokeWeight(2);

  // x 轴：v = 0，u 从 startU 到 endU
  let ax1Math = { x: startU * mathA.x + 0 * mathB.x, y: startU * mathA.y + 0 * mathB.y };
  let ax2Math = { x: endU   * mathA.x + 0 * mathB.x, y: endU   * mathA.y + 0 * mathB.y };
  let ax1 = mathToScreen(ax1Math.x, ax1Math.y);
  let ax2 = mathToScreen(ax2Math.x, ax2Math.y);
  line(ax1.x, ax1.y, ax2.x, ax2.y);

  // y 轴：u = 0，v 从 startV 到 endV
  let ay1Math = { x: 0 * mathA.x + startV * mathB.x, y: 0 * mathA.y + startV * mathB.y };
  let ay2Math = { x: 0 * mathA.x + endV   * mathB.x, y: 0 * mathA.y + endV   * mathB.y };
  let ay1 = mathToScreen(ay1Math.x, ay1Math.y);
  let ay2 = mathToScreen(ay2Math.x, ay2Math.y);
  line(ay1.x, ay1.y, ay2.x, ay2.y);

  //演示四边形

  if (showQuad) {
    push();
    let quadScreen = quadUV.map(pt => {
      let mx = pt.u * mathA.x + pt.v * mathB.x;
      let my = pt.u * mathA.y + pt.v * mathB.y;
      return mathToScreen(mx, my);
    });

    fill(255, 180, 60, 120);
    stroke(255, 200, 80);
    strokeWeight(2);
    beginShape();
    for (let p of quadScreen) vertex(p.x, p.y);
    endShape(CLOSE);

    // 计算数学空间原始面积
    let areaUV = polygonArea(quadUV.map(pt => ({ x: pt.u, y: pt.v })));

    // 在四边形"中间"写面积
    // 用四个顶点的平均作为中心（凸四边形够用；凹四边形建议用质心公式）
    let cx = 0, cy = 0;
    for (let p of quadScreen) { cx += p.x; cy += p.y; }
    cx /= quadScreen.length;
    cy /= quadScreen.length;

    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(16);
    // 显示：变换后面积 / 原始面积 = |det|
    text(`S = ${areaUV.toFixed(1)}`, cx, cy - 10);
    text(`det = ${(mathA.x * mathB.y - mathA.y * mathB.x).toFixed(2)}`, cx, cy + 10);
    text(`线性变换后:S'= S x |det|=${(areaUV*Math.abs(mathA.x * mathB.y - mathA.y * mathB.x)).toFixed(2)}`,cx, cy + 30)

    pop();
  }
    
  pop();
}

//向量
function drawArrow(x1, y1, x2, y2, col) {
  push(); 

  stroke(col);
  fill(col); 
  strokeWeight(3);
  
  line(x1, y1, x2, y2);
  let angle = atan2(y2 - y1, x2 - x1); 
  translate(x2, y2);
  rotate(angle);

  let arrowSize = 10; // 箭头大小，可根据需要调整
  let halfSize = arrowSize / 2;
  triangle(0, 0, -arrowSize, -halfSize, -arrowSize, halfSize);
  
  pop()
}

function drawTestVectors() {
  let mathA = polarToCartesian(vecA.angle, vecA.length);
  let mathB = polarToCartesian(vecB.angle, vecB.length);
  let mathSum = { x: mathA.x + mathB.x, y: mathA.y + mathB.y };

  let origin = mathToScreen(0, 0);
  let screenA = mathToScreen(mathA.x, mathA.y);
  let screenB = mathToScreen(mathB.x, mathB.y);
  let screenSum = mathToScreen(mathSum.x, mathSum.y);
  let detValue = computeDeterminant(mathA.x, mathA.y, mathB.x, mathB.y);
  let areaValue = computeParallelogramArea(mathA.x, mathA.y, mathB.x, mathB.y);
  let theta = computeAngleBetween(mathA.x, mathA.y, mathB.x, mathB.y);
  let magA = vecA.length;
  let magB = vecB.length;

  drawDynamicGrid(mathA, mathB);

  if (detValue>0.0001||detValue<-0.0001) {
    drawParallelogram(origin, screenA, screenB, screenSum);
  }
  
  // 画向量 A (黄色)
  drawArrow(origin.x, origin.y, screenA.x, screenA.y, color(243, 198, 35));
  drawColumnVector(screenA.x, screenA.y, mathA.x, mathA.y, color(243, 198, 35));
  // 画向量 B (粉色)
  drawArrow(origin.x, origin.y, screenB.x, screenB.y, color(232, 106, 146));
  drawColumnVector(screenB.x, screenB.y, mathB.x, mathB.y, color(232, 106, 146));

  drawHUD(mathA, mathB, detValue, areaValue, theta, magA, magB);
  
  if (detValue<0.0001&&detValue>-0.0001) {
    drawCollapseWarning();
  }

}

// 画平行四边形
function drawParallelogram(screenOrigin, screenA, screenB, screenSum) {
  push(); // 隔离样式
  
  // 设置填充色和边框线
  fill(237, 152, 91, 60); 
  stroke(237, 152, 91); 
  strokeWeight(2);
  
  // 按顺序连接四个顶点
  beginShape();
  vertex(screenOrigin.x, screenOrigin.y); // 原点
  vertex(screenA.x, screenA.y);           // 向量 A 的终点
  vertex(screenSum.x, screenSum.y);       // A+B 的终点（对角点）
  vertex(screenB.x, screenB.y);           // 向量 B 的终点
  endShape(CLOSE); // CLOSE 会自动把最后一个点和第一个点连起来

  fill(255);
  noStroke();
  textSize(18);
  textFont("Cambria Math")
  text('|det|',(screenSum.x+screenOrigin.x)/2-20,(screenSum.y+screenOrigin.y)/2+5);
  
  pop();
}

// 在指定屏幕坐标处画列向量 [x, y]
function drawColumnVector(screenX, screenY, mathX, mathY, col) {
  push();
  
  // 设置样式
  noStroke();
  fill(col);
  textSize(16);
  textAlign(LEFT, CENTER); // 左对齐，垂直居中
  
  // 偏移，免得挡住箭头尖端
  let offsetX = 15; 
  let offsetY = -15;
  let startX = screenX + offsetX;
  let startY = screenY + offsetY;
  
  // 格式化数字，保留2位小数
  let strX = mathX.toFixed(2);
  let strY = mathY.toFixed(2);
  
  let lineSpacing = 18; // 行距
  text(strX, startX + 10, startY - lineSpacing/2);
  text(strY, startX + 10, startY + lineSpacing/2);
  
  // 画方括号
  stroke(col);
  strokeWeight(1.5);
  let bracketWidth = 6;  // 括号宽度
  let bracketHeight = 26; // 括号高度
  
  // 左括号 [
  line(startX, startY - bracketHeight/2, startX - bracketWidth, startY - bracketHeight/2);
  line(startX - bracketWidth, startY - bracketHeight/2, startX - bracketWidth, startY + bracketHeight/2);
  line(startX - bracketWidth, startY + bracketHeight/2, startX, startY + bracketHeight/2);
  
  // 右括号 ]
  let rightX = startX + 50; // 根据文字长度大概估算右括号位置
  line(rightX, startY - bracketHeight/2, rightX + bracketWidth, startY - bracketHeight/2);
  line(rightX + bracketWidth, startY - bracketHeight/2, rightX + bracketWidth, startY + bracketHeight/2);
  line(rightX + bracketWidth, startY + bracketHeight/2, rightX, startY + bracketHeight/2);
  
  pop();
}


// 画左上角的行列式与面积面板
function drawHUD(mathA, mathB, detValue, areaValue, theta, magA, magB) {
  push();
  
  let hudX = 40;
  let hudY = 30;
  let lineSpacing = 24;
  
  // 代数视角：矩阵的行列式
  fill(255);
  noStroke();
  textSize(16);
  textFont("Cambria Math")
  textAlign(LEFT, TOP);
  
  text("矩阵的行列式：", hudX, hudY);
  hudY += lineSpacing + 10;

  fill(255);
  text('det',10,75);
  
  // 矩阵元素
  fill(243, 198, 35)
  text(mathA.x.toFixed(2), hudX + 20, hudY);
  fill(232, 106, 146)
  text(mathB.x.toFixed(2), hudX + 90, hudY);
  fill(243, 198, 35)
  text(mathA.y.toFixed(2), hudX + 20, hudY + lineSpacing);
  fill(232, 106, 146)
  text(mathB.y.toFixed(2), hudX + 90, hudY + lineSpacing);
  
  // 矩阵方括号
  stroke(255);
  strokeWeight(1.5);
  line(hudX + 10, hudY - 5, hudX, hudY - 5);
  line(hudX, hudY - 5, hudX, hudY + lineSpacing + 20);
  line(hudX, hudY + lineSpacing + 20, hudX + 10, hudY + lineSpacing + 20);
  let rightBracketX = hudX + 125;
  line(rightBracketX, hudY - 5, rightBracketX + 10, hudY - 5);
  line(rightBracketX + 10, hudY - 5, rightBracketX + 10, hudY + lineSpacing + 20);
  line(rightBracketX + 10, hudY + lineSpacing + 20, rightBracketX, hudY + lineSpacing + 20);

  // 等号和行列式结果
  noStroke();
  fill(255)
  text("=", hudX + 150, hudY + lineSpacing/2);
  fill(255,255,255); 
  textSize(18);
  text(detValue.toFixed(2), hudX + 170, hudY + lineSpacing/2 - 2);
  
  // 几何视角：平行四边形面积
  hudY += lineSpacing * 2 + 40; // 向下换行
  
  fill(255);
  textSize(16);
  text("平行四边形面积：", hudX, hudY);
  text("S = ",20,210)
  
  hudY += lineSpacing + 10;
  
  // 计算 |a| * |b| * sin(θ) 的拆解值
  let sinTheta = Math.sin(radians(theta));
  
  // 第一行：公式展示
  text("|a| × |b| × sin(θ)", hudX + 15, hudY);
  
  // 第二行：代入数值
  hudY += lineSpacing;
  
  //代入 |a|
  fill(243, 198, 35); // 黄色对应向量 a
  text(magA.toFixed(1), hudX + 15, hudY);
  
  fill(255);
  text("×", hudX + 45, hudY);
  
  //代入 |b|
  fill(232, 106, 146); // 粉色对应向量 b
  text(magB.toFixed(1), hudX + 60, hudY);
  
  fill(255);
  text("×", hudX + 90, hudY);
  
  //代入 sin(θ)
  fill(100, 200, 255); // 浅蓝色对应角度
  text(sinTheta.toFixed(3), hudX + 105, hudY);
  
  fill(255);
  text("=", hudX + 160, hudY);
  
  //最终面积结果
  fill(237, 152, 91); 
  textSize(18);
  text(areaValue.toFixed(2), hudX + 180, hudY - 2);
  
  pop();
}

//线性相关提醒
function drawCollapseWarning() {
  push();
  
  // 1. 全屏半透明红色遮罩，营造警报感
  noStroke();
  fill(150, 0, 0, 60);
  rect(0, 0, width, height);
  
  // 2. 居中的提示框
  let boxW = 400;
  let boxH = 120;
  let boxX = width / 2;
  let boxY = height / 2;
  
  // 提示框背景（深红玻璃态）
  fill(60, 30, 30, 220);
  stroke(255, 50, 50);
  strokeWeight(2);
  rectMode(CENTER);
  rect(boxX, boxY, boxW, boxH, 10);
  
  // 3. 文字内容
  noStroke();
  fill(255, 50, 50);
  textSize(20);
  textAlign(CENTER, CENTER);
  text("线性相关", boxX, boxY - 20);
  
  fill(255);
  textSize(18);
  text("2维平面坍缩成1维的线", boxX, boxY+5);

  fill(255, 50, 50);
  text("此时行列式为0", boxX, boxY+30);
  
  pop();
}


/*交互层*/


function setupControls() {
  // 1. 获取所有需要的元素
  let sliders = {
    aAngle: select('#slider-a-angle'),
    aLength: select('#slider-a-length'),
    bAngle: select('#slider-b-angle'),
    bLength: select('#slider-b-length')
  };
  
  let spans = {
    aAngle: select('#val-a-angle'),
    aLength: select('#val-a-length'),
    bAngle: select('#val-b-angle'),
    bLength: select('#val-b-length')
  };

  // 2. 统一处理滑块输入的函数
  let updateFromSlider = (target, sliderElem, spanElem, obj, key) => {
    let val = parseFloat(sliderElem.value());
    obj[key] = val;
    spanElem.html(val.toFixed(1)); // 统一保留一位小数
  };

  // 绑定滑块拖动事件
  sliders.aAngle.input(() => updateFromSlider('aAngle', sliders.aAngle, spans.aAngle, vecA, 'angle'));
  sliders.aLength.input(() => updateFromSlider('aLength', sliders.aLength, spans.aLength, vecA, 'length'));
  sliders.bAngle.input(() => updateFromSlider('bAngle', sliders.bAngle, spans.bAngle, vecB, 'angle'));
  sliders.bLength.input(() => updateFromSlider('bLength', sliders.bLength, spans.bLength, vecB, 'length'));

  // 3. 处理“微调按钮 (+/-)”
  let stepBtns = selectAll('.step-btn');
  stepBtns.forEach(btn => {
    btn.mousePressed(() => {
      let target = btn.attribute('data-target'); // 获取目标属性
      let step = parseFloat(btn.attribute('data-step')); // 获取步长
      
      // 映射到对应的滑块和状态
      let slider, span, obj, key;
      if (target === 'a-angle') { slider = sliders.aAngle; span = spans.aAngle; obj = vecA; key = 'angle'; }
      if (target === 'a-length') { slider = sliders.aLength; span = spans.aLength; obj = vecA; key = 'length'; }
      if (target === 'b-angle') { slider = sliders.bAngle; span = spans.bAngle; obj = vecB; key = 'angle'; }
      if (target === 'b-length') { slider = sliders.bLength; span = spans.bLength; obj = vecB; key = 'length'; }

      // 获取当前值，加上步长
      let newVal = parseFloat(slider.value()) + step;
      
      // 确保不超出 HTML 里设置的 min/max
      let min = parseFloat(slider.elt.min);
      let max = parseFloat(slider.elt.max);
      newVal = Math.max(min, Math.min(max, newVal));

      // 更新滑块的值和状态
      slider.value(newVal);
      obj[key] = newVal;
      span.html(newVal.toFixed(1));
    });
  });

  // 4. 处理面板折叠/展开
  let panel = select('#control-panel');
  let toggleBtn = select('#toggle-btn');
  toggleBtn.mousePressed(() => {
    panel.toggleClass('collapsed');
  });

  // 5. 处理重置按钮
  select('#reset-btn').mousePressed(() => {
    // 恢复初始值
    vecA = { angle: 0, length: 2 };
    vecB = { angle: 90, length: 2 };
    
    // 更新滑块 UI
    sliders.aAngle.value(vecA.angle);
    sliders.aLength.value(vecA.length);
    sliders.bAngle.value(vecB.angle);
    sliders.bLength.value(vecB.length);
    
    // 更新文本显示
    spans.aAngle.html(vecA.angle.toFixed(1));
    spans.aLength.html(vecA.length.toFixed(1));
    spans.bAngle.html(vecB.angle.toFixed(1));
    spans.bLength.html(vecB.length.toFixed(1));
  });
}


/*生命周期层*/


function setup() {
  // 把画布挂载到 HTML 里预留的那个 div 上
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-container');

  setupControls();
  
  quadButton = createButton('显示演示四边形');
  quadButton.addClass('demo-btn demo-btn-right');
  quadButton.mousePressed(toggleQuad);

}

function toggleQuad() {
  showQuad = !showQuad;
  quadButton.html(showQuad ? '隐藏演示四边形' : '显示演示四边形');
  quadButton,toggleClass('active',showQuad);
}

function draw() {
  background(0); //暗色风格坐标系
  drawGrid(); 
  drawTestVectors();     
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}