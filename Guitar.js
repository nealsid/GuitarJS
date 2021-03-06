class Guitar {
  constructor(guitarStrings) {
    this.guitarStrings = guitarStrings;
  }
}

class GuitarString {
  constructor(number, tuning) {
    this.number = number; // 0-5
    this.tuning = tuning; // a note
  }
}

const stringHeight = 3;
const numStrings = 6;
const stringSpacing = 150 / numStrings;
const numFrets = 12;
const fretWidth = Math.ceil(950 / numFrets);
const fretBarWidth = 5;
const fretHeight = 150; // same as fretboard

class GuitarRender {
  constructor(guitar, canvasElement) {
    this.guitar = guitar;
    this.canvasElement = canvasElement;
    this.guitarStringCoordinates = Array(guitar.guitarStrings.length).fill(null);

    this.fretboardRectangle = new Rectangle(50, 50, 1000, 150); // Canvas-relative
    this.ctx = this.canvasElement.getContext('2d');

    this.background = 'rgb(0, 0, 255)';
    this.fretBoardColor = 'rgb(133, 94, 66)';
    this.fretBarColor = 'rgb(232, 202, 100)';
    this.fretDotColor = 'rgb(127, 127, 127)';
    this.stringColor = 'rgb(209, 209, 207)';
  }

  // Returns upper left coordinate of fret on string in
  // canvas-relative coordinates.
  getCoordinatesOfFret(stringNumber, fretNumber) {
    return {
      'x' : this.fretboardRectangle.x + fretNumber * fretWidth,
      'y' : this.fretboardRectangle.y + stringNumber * (stringSpacing + stringHeight)
    };
  }

  draw() {
    let ctx = this.ctx;
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    ctx.fillStyle = this.fretBoardColor;
    ctx.fillRect(this.fretboardRectangle.x,
                 this.fretboardRectangle.y,
                 this.fretboardRectangle.width,
                 this.fretboardRectangle.height);

    ctx.fillStyle = this.fretBarColor;
    for (var i = 0; i < numFrets ; i++) {
      ctx.fillRect(50 + i * fretWidth, 50, fretBarWidth, fretHeight);
    }
    const fretDotRadius = 10;
    let fretsWithDots = [3, 5, 7, 9, 12];
    ctx.fillStyle = this.fretDotColor;
    fretsWithDots.forEach((fretNumber) => {
      var fretUl = this.getCoordinatesOfFret(1, fretNumber);
      ctx.beginPath();
      ctx.arc(fretUl.x + fretWidth / 2, fretUl.y + 11, fretDotRadius, 0, 2 * Math.PI, false);
      ctx.fill();

      fretUl = this.getCoordinatesOfFret(4, fretNumber);
      ctx.beginPath();
      ctx.arc(fretUl.x + fretWidth / 2, fretUl.y + 2, fretDotRadius, 0, 2 * Math.PI, false);
      ctx.fill();
    });


    let stringCoordinates = [];

    this.guitar.guitarStrings.forEach((guitarString) => this.drawString(guitarString));
    this.addStringClickHandler();
  }

  drawString(guitarString) {
    let stringNumber = guitarString.number;

    let canvasStringRectangle = this.calculateRectangleForStringNumber(stringNumber);
    this.guitarStringCoordinates[stringNumber] = this.convertCanvasRectangleToFretboardRectangle(canvasStringRectangle);  // store it for hit testing.
    this.ctx.fillStyle = this.stringColor;
    this.ctx.fillRect(canvasStringRectangle.x,
                      canvasStringRectangle.y,
                      canvasStringRectangle.width,
                      canvasStringRectangle.height);
  }

  calculateRectangleForStringNumber(stringNumber) {
    return new Rectangle(this.fretboardRectangle.x,
			 this.fretboardRectangle.y + stringSpacing * stringNumber,
			 this.fretboardRectangle.width,
			 stringHeight);
  }

  convertCanvasRectangleToFretboardRectangle(canvasRectangle) {
    return new Rectangle(canvasRectangle.x - this.fretboardRectangle.x,
			 canvasRectangle.y - this.fretboardRectangle.y,
			 canvasRectangle.width,
			 canvasRectangle.height);
  }

  addStringClickHandler(handler) {
    this.canvasElement.onclick = (e) => {
      console.log('click canvas' + e);
      var fretboardCoords = this.turnClientCoordinatesIntoFretboardRelativeCoordinates(e.clientX, e.clientY);
      var fretNumber = this.getFretNumberForCoords(fretboardCoords);
      console.log(fretNumber);
      console.log(this.isCoordinateOnString(fretboardCoords));
      guitarInstrument.strumChord(0, true, 1.0, [3, 2, 0, 0, 0, 3]);
    };
  }

  turnClientCoordinatesIntoFretboardRelativeCoordinates(clientX, clientY) {
    return {
      'x': clientX - (this.canvasElement.offsetLeft + this.fretboardRectangle.x),
      'y': clientY - (this.canvasElement.offsetTop + this.fretboardRectangle.y)
    };
  }

  getFretNumberForCoords(fretboardCoords) {
    return Math.floor(fretboardCoords.x / (fretWidth + fretBarWidth)) + 1;
  }

  isCoordinateOnString(fretboardCoords) {
    for (var i = 0; i < this.guitarStringCoordinates.length; i++) {
      let stringCoordinates = this.guitarStringCoordinates[i];
      var stringYStart = stringCoordinates.y;
      var stringYEnd = stringYStart + stringHeight;

      if (fretboardCoords.y >= stringYStart && fretboardCoords.y <= stringYEnd) {
	return true;
      }
    }
    return false;
  }

}
