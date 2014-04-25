;(function(window, d3, $, utils){
	var DEFAULTS = {
		width: 500,
		height: 300,
		barSpacing: 0.3,
		animationDuration: 1200,
		diagramStrokeColor: '#c3c3c3',
		diagramFillColor: '#ffffff',
		labelDistance: 10,
		labelFont: 'Verdana',
		labelSize: 12
	};

	function BarChart(cfg) {
		var self = this;
		
		this.options = $.extend({}, DEFAULTS, cfg);
		
		this._ = {};
		this._.oldData = [];
		this._.barsData = [];
		this._.labelMargin = Math.ceil(this.options.labelDistance + this.options.labelSize * 1.2);
		this._.diagramWidth = this.options.width - this._.labelMargin;
		this._.diagramHeight = this.options.height - this._.labelMargin;
		this._.scaleX = d3.scale.ordinal()
			.rangeRoundBands([0, this._.diagramWidth], this.options.barSpacing, this.options.barSpacing * 0.75);
		this._.scaleY = d3.scale.linear()
			.nice()
			.rangeRound([this._.diagramHeight, this.options.barSpacing * this._.diagramHeight / this.options.data.value.length / 0.75]);
		this._.labelSettings = function() {
			this.attr('text-anchor', 'middle')
				.attr('font-size', self.options.labelSize)
				.attr('font-family', self.options.labelFont);
		};
				
		// function to build bar height and offsets
		this._.getBarsData = function(data) {
			var barsData = [];

			$.each(data.value, function(barI, bar){
				var y0 = 0;
				var barData = bar instanceof Array ? $.extend([], bar) : [bar];

				barData = $.map(barData, function(sectionValue, sectionI){
					return {
						y0: y0,
						y1: y0 += sectionValue,
						color: self._.fillColors(barI, sectionI),
						bar: barI,
						total: barData.length
					};
				});
				barData.total = barData[barData.length-1].y1;
				barData.label = data.label[barI];
				barsData.push(barData);
			});
			return barsData;
		};

		// function to fill slice colors
		this._.fillColors = function(barIndex, sectionIndex){
			var barColor;
			var barSections = self.options.data.value[barIndex].length || 1;

			if (self.options.data.color instanceof Array && self.options.data.color[sectionIndex]) {
				barColor = self.options.data.color[barIndex];
			} else {
				barColor = utils.colorScale(barIndex);
			}

			if (typeof barColor === 'string') {
				return d3.rgb(barColor).brighter(sectionIndex / barSections).toString();
			} else if (barColor instanceof Array && barColor[sectionIndex]) {
				return barColor[sectionIndex];
			}
		};
		
		// function for binding arc update transition
		this._.updateBar = function(barData, i){
			var bar = d3.select(this).selectAll('rect')
				.data(barData);

			bar.enter().append('rect')
					.attr('fill', function(d){ return d.color; })
					.attr('height', 0)
					.attr('y', function(d){ return self._.scaleY(d.y0); })
					.attr('width', self._.scaleX.rangeBand())
					.call(self._.updateSection);

			bar.call(self._.updateSection);

			bar.exit().remove();

			// this.bars.select('rect').call(this._.updateBar);
		};
		this._.updateSection = function() {
			this.transition()
				.ease('linear')
				.duration(self.options.animationDuration / 2)
				.delay(function(d,i){
					return (i*self.options.animationDuration / d.total) + (d.bar / self._.barsData.length * (self.options.animationDuration - (self.options.animationDuration / 2)));
				})
				.attr('height', function(d){
					return self._.scaleY(d.y0) - self._.scaleY(d.y1);
				})
				.attr('y', function(d){
					return self._.scaleY(d.y1);
				});
		};
		
		this.svg = d3.select(this.options.element).append('svg')
			.attr('width', this.options.width)
			.attr('height', this.options.height);
		
		// build main groups
		this.diagram = this.svg.append('g');
		this.chart = this.diagram.append('g')
			.attr('transform', 'translate('+utils.cleanPx(this._.labelMargin)+',0.5)');

		if (this.options.yLabel) {
			this.chart.append('text')
				.text(this.options.yLabel)
				.attr('x', this._.diagramHeight / -2)
				.attr('y', this.options.labelSize * -1)
				.attr('transform', 'rotate(-90, 0, 0)')
				.call(this._.labelSettings);
		}

		this.chart.append('rect')
			.attr('height', this._.diagramHeight)
			.attr('width', this._.diagramWidth)
			.attr('fill', this.options.diagramFillColor)
			.attr('stroke-width', 1)
			.attr('stroke', this.options.diagramStrokeColor);
		
		this.refresh();
	}
	
	// Draw the pie arcs
	BarChart.prototype.refresh = function() {
		var self = this;

		this._.barsData = this._.getBarsData(this.options.data);
		this._.scaleY.domain([0, d3.max(this._.barsData, function(d){
			return d.total;
		})]);
		this._.scaleX.domain($.map(this._.barsData, function(d,i){
			return d.label;
		}));

		this.bars = this.chart.selectAll('g')
			.data(this._.barsData, function(d){
				console.log(d.label);
				return d.label;
			});

		var enterBars = this.bars.enter()
			.append('g')
				.attr('transform', function(d,i){
					return 'translate('+utils.cleanPx(self._.scaleX(d.label))+',-0.5)';
				});

		enterBars.append('text')
			.text(function(d){
				return d.label;
			})
			.attr('y', this._.diagramHeight + this._.labelMargin - (this.options.labelSize / 2))
			.attr('x', this._.scaleX.rangeBand() / 2)
			.call(this._.labelSettings);

		enterBars.each(this._.updateBar);
		this.bars.each(this._.updateBar);
	};
	
	// Set bar values
	BarChart.prototype.value = function(key, val) {
		var idx;
		if (typeof key === 'undefined') {
			// get all
			return $.extend(true, {}, this.options.data);
			
		} else if (typeof key === 'string' && typeof val === 'undefined') {
			// get one by label
			idx = this.options.data.label.indexOf(key);
			return idx !== -1 ? this.options.data.value[idx] : null;
												 
		} else if (typeof key === 'string') {
			// update one value by label
			return this.value({label: key, value: val});
			
		} else if (typeof key === 'object') {
			// update or append value object
			this._.oldData = $.extend(true, {}, this.options.data);
			idx = this.options.data.label.indexOf(key.label);
			
			if (idx !== -1) {
				// update
				this.options.data.value[idx] = key.value;
				if (key.label) this.options.data.label[idx] = key.label;
				if (key.color) this.options.data.color[idx] = key.color;
			} else {
				// append
				this.options.data.value.push(key.value);
				this.options.data.label.push(key.label);
				this.options.data.color.push(key.color);
			}
		}

		this.refresh();

		return this;
	};
	
	window.jqCharts.Bar = BarChart;
	
	// Utility Functions
	
}(window, d3, jQuery, jqCharts.utils));