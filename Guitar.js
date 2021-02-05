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
    }

    // returns upper left coordinate of fret on string
    getCoordinatesOfFret(stringNumber, fretNumber) {
        return {
            'x' : 50 + fretNumber * fretWidth,
            'y' : 50 + stringNumber * (stringSpacing + stringHeight)
        };
    }


    draw() {
	let fretboardStartX = 50; // canvas element relative
	let fretboardStartY = 50; // canvas element relative
	let fretboardWidth = 1000;
	let fretboardHeight = 150;
	const ctx = this.canvasElement.getContext('2d');
	ctx.fillStyle = 'rgb(0, 0, 255)';
	ctx.fillRect(0, 0, this.canvasElement.width, this.canvasElement.height);
	ctx.fillStyle = 'rgb(133, 94, 66)';
	ctx.fillRect(fretboardStartX, fretboardStartY, fretboardWidth, fretboardHeight);

	ctx.fillStyle = 'rgb(232, 202, 100)';
	for (var i = 0; i < numFrets ; i++) {
            ctx.fillRect(50 + i * fretWidth, 50, fretBarWidth, fretHeight);
	}
	const fretDotRadius = 10;
	let fretsWithDots = [3, 5, 7, 9, 12];
	ctx.fillStyle = 'rgb(127, 127, 127)';
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

	for (var i = 0; i < numStrings; i++) {
      	    stringCoordinates.push([50, 50 + stringSpacing * i, 1000, stringHeight]);
	}

	for (var i = 0; i < numStrings; i++) {
 	    stringCoordinates.push([50, 50 + stringSpacing * i, 1000, stringHeight]);
	}
	ctx.fillStyle = 'rgb(209, 209, 207)';
	for (var i = 0; i < stringCoordinates.length; i++) {
            ctx.fillRect(stringCoordinates[i][0],
			 stringCoordinates[i][1],
			 stringCoordinates[i][2],
			 stringCoordinates[i][3]);
	}
    }
}
