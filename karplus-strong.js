var guitarInstrument;
(function (){
    // calculate the constant used for the low-pass filter
    // used in the Karplus-Strong loop
    function calculateSmoothingFactor(string, tab, options) {
	var smoothingFactor;
	if (options.stringDampingCalculation == "direct") {
            smoothingFactor = options.stringDamping;
	} else if (options.stringDampingCalculation == "magic") {
            // this is copied verbatim from the flash one
            // is magical, don't know how it works
            var noteNumber = (string.semitoneIndex + tab - 19)/44;
            smoothingFactor =
		options.stringDamping +
		Math.pow(noteNumber, 0.5) * (1 - options.stringDamping) * 0.5 +
		(1 - options.stringDamping) *
		Math.random() *
		options.stringDampingVariation;
	}
	return smoothingFactor;
    }

    function getAudioContext() {
	if ('localAudioContext' in window) {
            return window.localAudioContext;
	}

	var constructor;
	var error;
	if ('AudioContext' in window) {
            // Firefox, Chrome
            constructor = window.AudioContext;
	} else if ('webkitAudioContext' in window) {
            // Safari
            constructor = window.webkitAudioContext;
	} else {
            return null;
	}

	var audioContext = new constructor();
	window.localAudioContext = audioContext;
	return audioContext;
    }

    function GuitarString(
	audioCtx, audioDestination, stringN, octave, semitone) {
	this.audioCtx = audioCtx;
	this.audioDestination = audioDestination;

	// work from A0 as a reference,
	// since it has a nice round frequency
	var a0_hz = 27.5;
	// an increase in octave by 1 doubles the frequency
	// each octave is divided into 12 semitones
	// the scale goes C0, C0#, D0, D0#, E0, F0, F0#, G0, G0#, A0, A0#, B0
	// so go back 9 semitones to get to C0
	var c0_hz = a0_hz * Math.pow(2, -9/12);
	this.basicHz = c0_hz * Math.pow(2, octave+semitone/12);
	this.basicHz = this.basicHz.toFixed(2);

	var basicPeriod = 1/this.basicHz;
	var basicPeriodSamples = Math.round(basicPeriod * audioCtx.sampleRate);
	this.seedNoise = generateSeedNoise(65535, basicPeriodSamples);

	// this is only used in a magical calculation of filter coefficients
	this.semitoneIndex = octave*12 + semitone - 9;

	// ranges from -1 for first string to +1 for last
	this.acousticLocation = (stringN - 2.5) * 0.4;

	this.mode = "karplus-strong";

	this.asmWrapper = new AsmFunctionsWrapper();

	function generateSeedNoise(seed, samples) {
            var noiseArray = new Float32Array(samples);
            for (var i = 0; i < samples; i++) {
		noiseArray[i] = -1 + 2*Math.random();
            }
            return noiseArray;
	}
    }


    GuitarString.prototype.pluck = function(startTime, velocity, tab) {
	// create the buffer we're going to write into
	var channels = 2;
	var sampleRate = audioCtx.sampleRate;
	// 1 second buffer
	var sampleCount = 1.0 * sampleRate;
	var buffer = this.audioCtx.createBuffer(channels, sampleCount, sampleRate);

	var options = {
            stringTension: 0.0,
            characterVariation: 0.5,
            stringDamping: 0.5,
            stringDampingVariation: 0.25,
            stringDampingCalculation: 'magic',
            pluckDamping: 0.5,
            pluckDampingVariation: 0.25,
            body: 'simple',
            stereoSpread: 0.2
	};

	var smoothingFactor = calculateSmoothingFactor(this, tab, options);
	// 'tab' represents which fret is held while plucking
	// each fret represents an increase in pitch by one semitone
	// (logarithmically, one-twelth of an octave)
	var hz = this.basicHz * Math.pow(2, tab/12);

	// to match original ActionScript source
	velocity /= 4;

	// TODO: make this a proper enum or something
	if (this.mode == "karplus-strong") {
            this.asmWrapper.pluck(
		buffer,
		this.seedNoise,
		sampleRate,
		hz,
		smoothingFactor,
		velocity,
		options,
		this.acousticLocation
            );
	} else if (this.mode == "sine") {
            var decayFactor = 8;
            this.asmWrapper.pluckDecayedSine(
		buffer,
		sampleRate,
		hz,
		velocity,
		decayFactor
            );
	}

	// create an audio source node fed from the buffer we've just written
	var bufferSource = this.audioCtx.createBufferSource();
	bufferSource.buffer = buffer;
	bufferSource.connect(this.audioDestination);

	bufferSource.start(startTime);
    };

    // JavaScript's class definitions are just functions
    // the function itself serves as the constructor for the class
    function Guitar(audioCtx, audioDestination) {
	// 'strings' becomes a 'property'
	// (an instance variable)
	this.strings = [
            // arguments are:
            // - audio context
            // - string number
            // - octave
            // - semitone
            new GuitarString(audioCtx, audioDestination, 0, 2, 4),   // E2
            new GuitarString(audioCtx, audioDestination, 1, 2, 9),   // A2
            new GuitarString(audioCtx, audioDestination, 2, 3, 2),   // D3
            new GuitarString(audioCtx, audioDestination, 3, 3, 7),   // G3
            new GuitarString(audioCtx, audioDestination, 4, 3, 11),  // B3
            new GuitarString(audioCtx, audioDestination, 5, 4, 4)    // E4
	];
    }

    // each fret represents an increase in pitch by one semitone
    // (logarithmically, one-twelth of an octave)
    // -1: don't pluck that string
    Guitar.C_MAJOR = [-1,  3, 2, 0, 0, 0];
    Guitar.G_MAJOR = [ 3,  2, 0, 0, 0, 3];
    Guitar.A_MINOR = [ 0,  0, 2, 2, 0, 0];
    Guitar.E_MINOR = [ 0,  2, 2, 0, 3, 0];

    // to add a class method in JavaScript,
    // we add a function property to the class's 'prototype' property
    Guitar.prototype.strumChord = function(time, downstroke, velocity, chord) {
	var pluckOrder;
	if (downstroke === true) {
            pluckOrder = [0, 1, 2, 3, 4, 5];
	} else {
            pluckOrder = [5, 4, 3, 2, 1, 0];
	}

	for (var i = 0; i < 6; i++) {
            var stringNumber = pluckOrder[i];
            if (chord[stringNumber] != -1) {
		this.strings[stringNumber].pluck(time, velocity, chord[stringNumber]);
            }
            time += Math.random()/128;
	}

    };

    Guitar.prototype.setMode = function(mode) {
	for (var i = 0; i < 6; i++) {
            this.strings[i].mode = mode;
	}
    };

    var audioCtx = getAudioContext();

    guitarInstrument = new Guitar(audioCtx, audioCtx.destination);

    function AsmFunctionsWrapper() {
    }

    AsmFunctionsWrapper.prototype.initAsm = function(heapSize) {
	var roundedHeapSize = getNextValidFloat32HeapLength(heapSize);

	// asm.js requires all data in/out of function to
	// be done through heap object
	// we don't want to allocate a new heap on every call,
	// so we reuse a static variable
	// but seedNoise.length will be different depending on the string,
	// so be willing to enlarge it if necessary
	this.heap = new Float32Array(roundedHeapSize);

	// from the asm.js spec, it sounds like the heap must be
	// passed in as a plain ArrayBuffer
	// (.buffer is the ArrayBuffer referenced by the Float32Buffer)
	var heapBuffer = this.heap.buffer;
	// any non-asm.js functions must be referenced through a
	// "foreign function" interface
	var foreignFunctions = {
            random: Math.random,
            round: Math.round,
	};
	// we specifically do this here so that we only recreate
	// the asm functions if we really have to
	// that way, V8 will be able to cache optimized versions
	// of the functions
	this.asm = asmFunctions(window, foreignFunctions, heapBuffer);
    };

    AsmFunctionsWrapper.prototype.pluckDecayedSine = function(
	channelBuffer,
	sampleRate,
	hz,
	velocity,
	decayFactor
    ) {

	var requiredHeapSize = channelBuffer.length;
	if (typeof(this.heap) == 'undefined') {
            this.initAsm(requiredHeapSize);
	}
	if (requiredHeapSize > this.heap.length) {
            this.initAsm(requiredHeapSize);
	}


	var heapOffsets = {
            targetStart: 0,
            targetEnd: channelBuffer.length-1
	};

	var heapFloat32 = this.heap;
	var asm = this.asm;

	asm.renderDecayedSine(heapOffsets.targetStart,
                              heapOffsets.targetEnd,
                              sampleRate,
                              hz,
                              velocity,
                              decayFactor);

	var targetArrayL = channelBuffer.getChannelData(0);
	var targetArrayR = channelBuffer.getChannelData(1);
	for (i = 0; i < targetArrayL.length; i++) {
            targetArrayL[i] = heapFloat32[i];
            targetArrayR[i] = heapFloat32[i];
	}
    };

    AsmFunctionsWrapper.prototype.pluck = function(
	channelBuffer,
	seedNoise,
	sampleRate,
	hz,
	smoothingFactor,
	velocity,
	options,
	acousticLocation
    ) {

	var requiredHeapSize = seedNoise.length + channelBuffer.length;
	if (typeof(this.heap) == 'undefined') {
            this.initAsm(requiredHeapSize);
	}
	if (requiredHeapSize > this.heap.length) {
            this.initAsm(requiredHeapSize);
	}

	var heapFloat32 = this.heap;
	var asm = this.asm;

	var i;
	for (i = 0; i < seedNoise.length; i++) {
            heapFloat32[i] = seedNoise[i];
	}

	var heapOffsets = {
            seedStart: 0,
            seedEnd: seedNoise.length - 1,
            targetStart: seedNoise.length,
            targetEnd: seedNoise.length + channelBuffer.length - 1
	};

	asm.renderKarplusStrong(heapOffsets.seedStart,
				heapOffsets.seedEnd,
				heapOffsets.targetStart,
				heapOffsets.targetEnd,
				sampleRate,
				hz,
				velocity,
				smoothingFactor,
				options.stringTension,
				options.pluckDamping,
				options.pluckDampingVariation,
				options.characterVariation);

	if (options.body == "simple") {
            asm.resonate(heapOffsets.targetStart, heapOffsets.targetEnd);
	}

	asm.fadeTails(heapOffsets.targetStart,
                      heapOffsets.targetEnd - heapOffsets.targetStart + 1);

	var targetArrayL = channelBuffer.getChannelData(0);
	var targetArrayR = channelBuffer.getChannelData(1);
	// string.acousticLocation is set individually for each string such that
	// the lowest note has a value of -1 and the highest +1
	var stereoSpread = options.stereoSpread * acousticLocation;
	// for negative stereoSpreads, the note is pushed to the left
	// for positive stereoSpreads, the note is pushed to the right
	var gainL = (1 - stereoSpread) * 0.5;
	var gainR = (1 + stereoSpread) * 0.5;
	for (i = 0; i < targetArrayL.length; i++) {
            targetArrayL[i] = heapFloat32[heapOffsets.targetStart+i] * gainL;
	}
	for (i = 0; i < targetArrayL.length; i++) {
            targetArrayR[i] = heapFloat32[heapOffsets.targetStart+i] * gainR;
	}
    };

    // http://asmjs.org/spec/latest/#modules
    // the byte length must be 2^n for n in [12, 24],
    // or for bigger heaps, 2^24 * n for n >= 1
    function getNextValidFloat32HeapLength(desiredLengthFloats) {
	var heapLengthBytes;
	var desiredLengthBytes = desiredLengthFloats << 2;

	if (desiredLengthBytes <= Math.pow(2, 12)) {
            heapLengthBytes = Math.pow(2, 12);
	} else if (desiredLengthBytes < Math.pow(2, 24)) {
            heapLengthBytes = Math.pow(2, Math.ceil(Math.log2(desiredLengthBytes)));
	} else {
            throw("Heap length greater than 2^24 bytes not implemented");
	}
	return heapLengthBytes;
    }

    // standard asm.js block
    // stdlib: object through which standard library functions are called
    // foreign: object through which external javascript functions are called
    // heap: buffer used for all data in/out of function
    function asmFunctions(stdlib, foreign, heapBuffer) {
	"use asm";

	// heap is supposed to come in as just an ArrayBuffer
	// so first need to get a Float32 view of it
	var heap = new stdlib.Float32Array(heapBuffer);
	var fround = stdlib.Math.fround;
	var sin = stdlib.Math.sin;
	var pi = stdlib.Math.PI;
	var floor = stdlib.Math.floor;
	var pow = stdlib.Math.pow;
	var random = foreign.random;
	var round = foreign.round;

	// simple discrete-time low-pass filter from Wikipedia
	function lowPass(lastOutput, currentInput, smoothingFactor) {
            // coersion to indicate type of arguments
            // +x represents double
            // we do all the arithmetic using doubles rather than floats,
            // because in the asm.js spec, operations done floats resolve
            // to 'floatish'es, which need to be coerced back into floats,
            // and the code becomes unreadable
            lastOutput = +lastOutput;
            currentInput = +currentInput;
            smoothingFactor = +smoothingFactor;

            var currentOutput = 0.0;
            currentOutput =
		smoothingFactor * currentInput +
		(1.0 - smoothingFactor) * lastOutput;

            return +currentOutput;
	}

	// simple discrete-time high-pass filter from Wikipedia
	function highPass(lastOutput, lastInput, currentInput, smoothingFactor) {
            lastOutput = +lastOutput;
            lastInput = +lastInput;
            currentInput = +currentInput;
            smoothingFactor = +smoothingFactor;

            var currentOutput = 0.0;
            currentOutput =
		smoothingFactor * lastOutput +
		smoothingFactor * (currentInput - lastInput);

            return +currentOutput;
	}

	// this is copied verbatim from the original ActionScript source
	// haven't figured out how it works yet
	function resonate(heapStart, heapEnd) {
            // '|0' declares parameter as int
            // http://asmjs.org/spec/latest/#parameter-type-annotations
            heapStart = heapStart|0;
            heapEnd = heapEnd|0;

            // explicitly initialise all variables so types are declared
            var r00 = 0.0;
            var f00 = 0.0;
            var r10 = 0.0;
            var f10 = 0.0;
            var f0 = 0.0;
            var c0 = 0.0;
            var c1 = 0.0;
            var r0 = 0.0;
            var r1 = 0.0;
            var i = 0;
            var resonatedSample = 0.0;
            var resonatedSamplePostHighPass = 0.0;
            // by making the smoothing factor large, we make the cutoff
            // frequency very low, acting as just an offset remover
            var highPassSmoothingFactor = 0.999;
            var lastOutput = 0.0;
            var lastInput = 0.0;

            // +x indicates that x is a double
            // (asm.js Math functions take doubles as arguments)
            c0 = 2.0 * sin(pi * 3.4375 / 44100.0);
            c1 = 2.0 * sin(pi * 6.124928687214833 / 44100.0);
            r0 = 0.98;
            r1 = 0.98;

            // asm.js seems to require byte addressing of the heap...?
            // http://asmjs.org/spec/latest/#validateheapaccess-e
            // yeah, when accessing the heap with an index which is an expression,
            // the total index expression is validated in a way that
            // forces the index to be a byte
            // and apparently '|0' coerces to signed when not in the context
            // of parameters
            // http://asmjs.org/spec/latest/#binary-operators
            for (i = heapStart << 2; (i|0) <= (heapEnd << 2); i = (i + 4)|0) {
		r00 = r00 * r0;
		r00 = r00 + (f0 - f00) * c0;
		f00 = f00 + r00;
		f00 = f00 - f00 * f00 * f00 * 0.166666666666666;
		r10 = r10 * r1;
		r10 = r10 + (f0 - f10) * c1;
		f10 = f10 + r10;
		f10 = f10 - f10 * f10 * f10 * 0.166666666666666;
		f0 = +heap[i >> 2];
		resonatedSample = f0 + (f00 + f10) * 2.0;

		// I'm not sure why, but the resonating process plays
		// havok with the DC offset - it jumps around everywhere.
		// We put it back to zero DC offset by adding a high-pass
		// filter with a super low cutoff frequency.
		resonatedSamplePostHighPass = +highPass(
                    lastOutput,
                    lastInput,
                    resonatedSample,
                    highPassSmoothingFactor
		);
		heap[i >> 2] = resonatedSamplePostHighPass;

		lastOutput = resonatedSamplePostHighPass;
		lastInput = resonatedSample;
            }
	}

	// apply a fade envelope to the end of a buffer
	// to make it end at zero ampltiude
	// (to avoid clicks heard when sample otherwise suddenly
	//  cuts off)
	function fadeTails(heapStart, length) {
            heapStart = heapStart|0;
            length = length|0;

            var heapEnd = 0;
            var tailProportion = 0.0;
            var tailSamples = 0;
            var tailSamplesStart = 0;
            var i = 0;
            var samplesThroughTail = 0;
            var proportionThroughTail = 0.0;
            var gain = 0.0;

            tailProportion = 0.1;
            // we first convert length from an int to an unsigned (>>>0)
            // so that we can convert it a double for the argument of floor()
            // then convert it to a double (+)
            // then convert the double result of floor to a signed with ~~
            // http://asmjs.org/spec/latest/#binary-operators
            // http://asmjs.org/spec/latest/#standard-library
            // http://asmjs.org/spec/latest/#binary-operators
            tailSamples = ~~floor(+(length>>>0) * tailProportion);
            // http://asmjs.org/spec/latest/#additiveexpression
            // the result of an additive addition is an intish,
            // which must be coerced back to an int
            tailSamplesStart = (heapStart + length - tailSamples)|0;

            heapEnd = (heapStart + length)|0;

            // so remember, i represents a byte index,
            // and the heap is a Float32Array (4 bytes)
            for (i = tailSamplesStart << 2, samplesThroughTail = 0;
		 (i|0) < (heapEnd << 2);
		 i = (i + 4)|0,
		 samplesThroughTail = (samplesThroughTail+1)|0) {
		proportionThroughTail =
                    (+(samplesThroughTail>>>0)) / (+(tailSamples>>>0));
		gain = 1.0 - proportionThroughTail;
		heap[i >> 2] = heap[i >> 2] * fround(gain);
            }
	}

	// the "smoothing factor" parameter is the coefficient
	// used on the terms in the main low-pass filter in the
	// Karplus-Strong loop
	function renderKarplusStrong(
            seedNoiseStart,
            seedNoiseEnd,
            targetArrayStart,
            targetArrayEnd,
            sampleRate, hz, velocity,
            smoothingFactor, stringTension,
            pluckDamping,
            pluckDampingVariation,
            characterVariation
	) {
            seedNoiseStart = seedNoiseStart|0;
            seedNoiseEnd = seedNoiseEnd|0;
            targetArrayStart = targetArrayStart|0;
            targetArrayEnd = targetArrayEnd|0;
            sampleRate = sampleRate|0;
            hz = +hz;
            velocity = +velocity;
            smoothingFactor = +smoothingFactor;
            stringTension = +stringTension;
            pluckDamping = +pluckDamping;
            pluckDampingVariation = +pluckDampingVariation;
            characterVariation = +characterVariation;

            var period = 0.0;
            var periodSamples = 0;
            var sampleCount = 0;
            var lastOutputSample = 0.0;
            var curInputSample = 0.0;
            var noiseSample = 0.0;
            var skipSamplesFromTension = 0;
            var curOutputSample = 0.0;
            var pluckDampingMin = 0.0;
            var pluckDampingMax = 0.0;
            var pluckDampingVariationMin = 0.0;
            var pluckDampingVariationMax = 0.0;
            var pluckDampingVariationDifference = 0.0;
            var pluckDampingCoefficient = 0.0;

            // the (byte-addressed) index of the heap as a whole that
            // we get noise samples from
            var heapNoiseIndexBytes = 0;
            // the (Float32-addressed) index of the portion of the heap
            // that we'll be writing to
            var targetIndex = 0;
            // the (byte-addressed) index of the heap as a whole where
            // we'll be writing
            var heapTargetIndexBytes = 0;
            // the (byte-addressed) index of the heap as a whole of
            // the start of the last period of samples
            var lastPeriodStartIndexBytes = 0;
            // the (byte-addressed) index of the heap as a whole from
            // where we'll be taking samples from the last period, after
            // having added the skip from tension
            var lastPeriodInputIndexBytes = 0;

            period = 1.0/hz;
            periodSamples = ~~(+round(period * +(sampleRate>>>0)));
            sampleCount = (targetArrayEnd-targetArrayStart+1)|0;

            /*
              |- pluckDampingMax
              |
              |               | - pluckDampingVariationMax         | -
              |               | (pluckDampingMax - pluckDamping) * |
              |               | pluckDampingVariation              | pluckDamping
              |- pluckDamping | -                                  | Variation
              |               | (pluckDamping - pluckDampingMin) * | Difference
              |               | pluckDampingVariation              |
              |               | - pluckDampingVariationMin         | -
              |
              |- pluckDampingMin
            */
            pluckDampingMin = 0.1;
            pluckDampingMax = 0.9;
            pluckDampingVariationMin =
		pluckDamping -
		(pluckDamping - pluckDampingMin) * pluckDampingVariation;
            pluckDampingVariationMax =
		pluckDamping +
		(pluckDampingMax - pluckDamping) * pluckDampingVariation;
            pluckDampingVariationDifference =
		pluckDampingVariationMax - pluckDampingVariationMin;
            pluckDampingCoefficient =
		pluckDampingVariationMin +
		(+random()) * pluckDampingVariationDifference;

            for (targetIndex = 0;
		 (targetIndex|0) < (sampleCount|0);
		 targetIndex = (targetIndex + 1)|0) {

		heapTargetIndexBytes = (targetArrayStart + targetIndex) << 2;

		if ((targetIndex|0) < (periodSamples|0)) {
                    // for the first period, feed in noise
                    // remember, heap index has to be bytes...
                    heapNoiseIndexBytes = (seedNoiseStart + targetIndex) << 2;
                    noiseSample = +heap[heapNoiseIndexBytes >> 2];
                    // create room for character variation noise
                    noiseSample = noiseSample * (1.0 - characterVariation);
                    // add character variation
                    noiseSample = noiseSample +
			characterVariation * (-1.0 + 2.0 * (+random()));
                    // also velocity
                    noiseSample = noiseSample * velocity;
                    // by varying 'pluck damping', we can control the spectral
                    // content of the input noise
                    curInputSample =
			+lowPass(curInputSample, noiseSample,
				 pluckDampingCoefficient);
		} else if (stringTension != 1.0) {
                    // for subsequent periods, feed in the output from
                    // about one period ago
                    lastPeriodStartIndexBytes =
			(heapTargetIndexBytes - (periodSamples << 2))|0;
                    skipSamplesFromTension =
			~~floor(stringTension * (+(periodSamples>>>0)));
                    lastPeriodInputIndexBytes =
			(lastPeriodStartIndexBytes +
			 (skipSamplesFromTension << 2))|0;
                    curInputSample = +heap[lastPeriodInputIndexBytes >> 2];
		} else {
                    // if stringTension == 1.0, we would be reading from the
                    // same sample we were writing to
                    // ordinarily, this would have the effect that only the first
                    // period of noise was preserved, and the rest of the buffer
                    // would be silence, but because we're reusing the heap,
                    // we'd actually be reading samples from old waves
                    curInputSample = 0.0;
		}

		// the current period is generated by applying a low-pass
		// filter to the last period
		curOutputSample =
                    +lowPass(lastOutputSample, curInputSample, smoothingFactor);

		heap[heapTargetIndexBytes >> 2] = curOutputSample;
		lastOutputSample = curOutputSample;
            }
	}

	function renderDecayedSine(
            targetArrayStart,
            targetArrayEnd,
            sampleRate, hz, velocity,
            decayFactor
	) {
            targetArrayStart = targetArrayStart|0;
            targetArrayEnd = targetArrayEnd|0;
            sampleRate = sampleRate|0;
            hz = +hz;
            velocity = +velocity;
            decayFactor = +decayFactor;

            var period = 0.0;
            var periodSamples = 0;
            var sampleCount = 0;
            // the (Float32-addressed) index of the portion of the heap
            // that we'll be writing to
            var targetIndex = 0;
            // the (byte-addressed) index of the heap as a whole where
            // we'll be writing
            var heapTargetIndexBytes = 0;

            var time = 0.0;

            period = 1.0/hz;
            periodSamples = ~~(+round(period * +(sampleRate>>>0)));
            sampleCount = (targetArrayEnd-targetArrayStart+1)|0;

            for (targetIndex = 0;
		 (targetIndex|0) < (sampleCount|0);
		 targetIndex = (targetIndex + 1)|0) {

		heapTargetIndexBytes = (targetArrayStart + targetIndex) << 2;

		// >>>0: convert from int to unsigned
		time = (+(targetIndex>>>0))/(+(sampleRate>>>0));
		heap[heapTargetIndexBytes >> 2] =
                    velocity *
                    pow(2.0, -decayFactor*time) *
                    sin(2.0 * pi * hz * time);
            }
	}

	return {
            renderKarplusStrong: renderKarplusStrong,
            renderDecayedSine: renderDecayedSine,
            fadeTails: fadeTails,
            resonate: resonate,
	};
    }
})();
