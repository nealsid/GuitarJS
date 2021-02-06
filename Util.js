class Rectangle {
  constructor(x, y, width, height) {
    this.point = new Point(x, y);
    this.width = width;
    this.height = height;
  }

  get x() {
    return this.point.x;
  }

  get y() {
    return this.point.y;
  }
}

class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}
