;(function(window, d3, $, utils){
	var DEFAULTS = {
	//	value: [],
	//	label: [],
	//	color: [],
		width: 300,
		height: 300,
		startAngle: 45,
		strokeWidth: 0.7,
		strokeColor: '#FFFFFF',
		innerRadius: 0,
		animationType: 'spin',
		animationDuration: 1200,
		labelDistance: 18,
		labelFont: 'Verdana',
		labelSize: 20
	};
	
	function PieChart(cfg) {
		var self = this;
		
		this.options = $.extend({}, DEFAULTS, cfg);

		// get utility methods specific to this instance
		buildUtils.call(this);
		
		this.svg = d3.select(this.options.element).append('svg')
			.attr('width', this.options.width)
			.attr('height', this.options.height);

		this.pie = this.svg.append('g')
			.attr('transform', 'translate('+utils.cleanPx(this.options.width / 2)+','+utils.cleanPx(this.options.height/2)+')');
		
		this.refresh();
	}

	
	// Draw the pie arcs
	PieChart.prototype.refresh = function() {
		this._.oldPieData = this._.pieData;
		var arrayBuffer = zeroFillArray(this.options.data, this._.oldData);
		this._.total = d3.sum(this.options.data, getDatumValue);
		this._.pieData = this._.getPieData(arrayBuffer);
		
		this.slices = this.pie.selectAll('g')
			.data(this._.pieData, function(d){
				return d.data.label;
			});
		
		var enterGroups = this.slices.enter()
			.append('g');
		
		enterGroups.append('path')
			.attr('fill', this._.fillColors)
			.attr('stroke', this.options.strokeColor)
			.attr('stroke-width', this.options.strokeWidth);

		enterGroups.append('text')
			.attr('text-anchor', 'middle')
			.attr('font-family', this.options.labelFont)
			.attr('font-size', this.options.labelSize);

		enterGroups.call(this._.updateArcGroup);
		
		this.slices.transition()
			.call(this._.updateArcGroup);
	};
	
	// Set pie values
	PieChart.prototype.value = function(key, val) {
		var idx;
		if (typeof key === 'undefined') {
			// get all
			return $.extend(true, [], this.options.data);
			
		} else if (typeof key === 'string' && typeof val === 'undefined') {
			// get one by label
			idx = utils.indexByProp(this.options.data, 'label', key);
			return idx !== -1 ? this.options.data[idx].value : null;
												 
		} else if (key instanceof Array) {
			// update an array of values
			this._.oldData = this.options.data;
			this.options.data = zeroFillArray(key, this._.oldData);
			this.refresh();
				
		} else if (typeof key === 'string') {
			// update an one value by label
			this.value({label: key, value: val});
			
		} else if (typeof key === 'object') {
			// update or append value object
			this._.oldData = $.extend(true, [], this.options.data);
			idx = utils.indexByProp(this.options.data, 'label', key.label);
			
			if (idx !== -1) {
				// update
				$.extend(this.options.data[idx], key);
			} else {
				// append
				this.options.data.push(key);
			}
			
			this.options.data = zeroFillArray(this.options.data, this._.oldData);
			this.refresh();
		}
		
		return this;
	};

	window.jqCharts.Pie = PieChart;
	
	
	// Utility Functions
	function buildUtils() {
		var self = this;

		this._ = {};
		this._.oldData = [];
		this._.pieData = [];
		this._.oldPieData = [];
		this._.innerRadius = this.options.innerRadius;
		this._.outerRadius = Math.min(this.options.width/2 - (this.options.labelSize * 2), this.options.height/2) - this.options.labelDistance - this.options.labelSize;
		this._.labelRadius = this._.outerRadius + this.options.labelDistance;
		this._.startAngle = degToRad(this.options.startAngle);

		// function for path string
		this._.arc = d3.svg.arc()
			.innerRadius(this._.innerRadius)
			.outerRadius(this._.outerRadius);

		// functions for label positioning
		this._.labelArcX = d3.svg.arc()
			.innerRadius(this._.labelRadius)
			.outerRadius(this._.labelRadius + this.options.labelSize * 3);
		this._.labelArcY = d3.svg.arc()
			.innerRadius(this._.labelRadius)
			.outerRadius(this._.labelRadius + this.options.labelSize);
		this._.labelPosition = function(dt){
			var x = self._.labelArcX.centroid(dt)[0];
			var y = self._.labelArcY.centroid(dt)[1];
			y += self.options.labelSize / 3;
			return [x,y];
		};
		
		// function for angles of arcs based on data
		this._.getPieData = d3.layout.pie()
			.startAngle(this._.startAngle)
			.endAngle(this._.startAngle + Math.PI * 2)
			.value(getDatumValue)
			.sort(null);
		
		// function to fill slice colors
		this._.fillColors = function(d, i){
			if (d.data.color) {
				return d.data.color;
			} else if (typeof self.options.fillColor === 'string') {
				return self.options.fillColor;
			}
		};
		
		// function for binding arc update transition
		this._.updateArcGroup = function(){
			this.transition()
				.duration(self.options.animationDuration)
				.tween('arcsize', function(d, i){
					var s, e, interpolate;
					
					if (self._.oldPieData[i]) {
						s = self._.oldPieData[i].startAngle;
						e = self._.oldPieData[i].endAngle;
					} else if (!self._.oldPieData[i] && self._.oldPieData[i-1]) {
						s = self._.oldPieData[i-1].endAngle;
						e = self._.oldPieData[i-1].endAngle;
					} else if (!self._.oldPieData[i-1] && self._.oldPieData.length) {
						s = self._.oldPieData[self._.oldPieData.length-1].endAngle;
						e = self._.oldPieData[self._.oldPieData.length-1].endAngle;
					} else {
						s = self._.startAngle;
						e = self._.startAngle;
					}
					
					interpolate = d3.interpolate({
						startAngle: s,
						endAngle: e
					}, {
						startAngle: d.startAngle,
						endAngle: d.endAngle
					});

					
					return function(t){
						var dt = interpolate(t);
						var labelPos = self._.labelPosition(dt);

						d3.select(this).select('path')
							.attr('d', self._.arc(dt));

						// prevent labels from colliding with chart
						d3.select(this).select('text')
							.attr('transform', 'translate('+labelPos+')');
					};
				}).each('end', function(){
					d3.select(this).select('text').text(function(d){
						if (d.value !== 0) return toPercent(d.value / self._.total);
						else return '';
					});
				});
		};
	};

	var toPercent = d3.format('.2p');

	function degToRad(deg) {return deg * Math.PI / 180;}

	function getDatumValue(d) {return d.value;}
	
	// merge two arrays of objects, filling missing objects with a value of 0
	function zeroFillArray(newA, oldA) {
		var keys = [], i, I;
		newA = $.extend(true, [], newA);
		
		for (i=0, I=newA.length; i<I; i++) {
			if (newA[i].label) keys.push(newA[i].label);
		}
		
		for (i=0, I=oldA.length; i<I; i++) {
			// object is labelled and missing from new array
			if (oldA[i].label && keys.indexOf(oldA[i].label) === -1) {
				newA.splice(i, 0, $.extend(true, {}, oldA[i], {value: 0}));
			}
		}
		
		return newA;
	}
	
}(window, d3, jQuery, jqCharts.utils));