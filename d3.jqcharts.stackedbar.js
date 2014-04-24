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

	function StackedBarChart(cfg) {
		var self = this;
		
		this.options = $.extend({}, DEFAULTS, cfg);
		
		this._ = {};
		this._.oldData = [];
		this._.stacksData = [];
		this._.labelMargin = Math.ceil(this.options.labelDistance + this.options.labelSize * 1.2);
		this._.diagramWidth = this.options.width - this._.labelMargin;
		this._.diagramHeight = this.options.height - this._.labelMargin;
		this._.scaleX = d3.scale.ordinal()
			.rangeRoundBands([0, this._.diagramWidth], this.options.barSpacing, this.options.barSpacing * 0.75);
		this._.scaleY = d3.scale.linear()
			.nice()
			.rangeRound([this._.diagramHeight, this.options.barSpacing * this._.diagramHeight / this.options.data.length / 0.75]);
		this._.labelSettings = function() {
			this.attr('text-anchor', 'middle')
				.attr('font-size', self.options.labelSize)
				.attr('font-family', self.options.labelFont);
		};
				
		// function to build bar height and offsets
		this._.getStacksData = function(stacks) {
			var stacksData = $.extend(true, [], stacks);

			$.each(stacksData, function(i, stack){
				var y0 = 0;
				stack.value = $.map(stack.value, function(section, ii){
					return {
						y0: y0,
						y1: y0 += section,
						color: self._.fillColors(stack, i, ii),
						stack: i
					};
				});
				stack.total = stack.value[stack.value.length-1].y1;
				return stack;
			});
			return stacksData;
		};
		// function to fill slice colors
		this._.fillColors = function(stack, stackIndex, sectionIndex){
			var stackColor = stack.color || utils.colorScale(stackIndex);

			if (typeof stackColor === 'string') {
				return d3.rgb(stackColor).brighter(sectionIndex / stack.value.length).toString();
			} else if (stackColor instanceof Array && stackColor[sectionIndex]) {
				return stackColor[sectionIndex];
			}
		};
		
		// function for binding arc update transition
		this._.updateBar = function(){
			this.transition()
				.duration(self.options.animationDuration / 2)
				.delay(function(d,i){return d.stack / self.options.data.length * (self.options.animationDuration - (self.options.animationDuration / 2));})
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
		this.bars = this.diagram.append('g')
			.attr('transform', 'translate('+utils.cleanPx(this._.labelMargin)+',0.5)');

		if (this.options.yLabel) {
			this.diagram.append('text')
				.text(this.options.yLabel)
				.attr('x', this._.diagramHeight / -2)
				.attr('y', this.options.labelSize)
				.attr('transform', 'rotate(-90, 0, 0)')
				.call(this._.labelSettings);
		}

		this.bars.append('rect')
			.attr('height', this._.diagramHeight)
			.attr('width', this._.diagramWidth)
			.attr('fill', this.options.diagramFillColor)
			.attr('stroke-width', 1)
			.attr('stroke', this.options.diagramStrokeColor);
		
		this.refresh();
	}
	
	// Draw the pie arcs
	StackedBarChart.prototype.refresh = function() {
		var self = this;

		this._.stacksData = this._.getStacksData(this.options.data);
		this._.scaleY.domain([0, d3.max(this._.stacksData, function(d){
			return d.total;
		})]);
		this._.scaleX.domain($.map(this._.stacksData, function(d,i){
			return d.label;
		}));

		this.stacks = this.bars.selectAll('g')
			.data(this._.stacksData, function(d){
				return d.label;
			});

		var enterStacks = this.stacks.enter()
			.append('g')
				.attr('transform', function(d,i){
					return 'translate('+utils.cleanPx(self._.scaleX(d.label))+',-0.5)';
				});

		enterStacks.append('text')
			.text(function(d){
				return d.label;
			})
			.attr('y', this._.diagramHeight + this._.labelMargin - (this.options.labelSize / 2))
			.attr('x', this._.scaleX.rangeBand() / 2)
			.call(this._.labelSettings);

		enterStacks.selectAll('rect')
			.data(function(d, i){
				return d.value;
			})
			.enter().append('rect')
				.attr('fill', function(d){ return d.color; })
				.attr('height', 0)
				.attr('y', this._.diagramHeight)
				.attr('width', self._.scaleX.rangeBand())
				.call(this._.updateBar);
	};
	
	// Set pie values
	StackedBarChart.prototype.value = function(key, val) {
		var idx;
		if (typeof key === 'undefined') {
			// get all
			return $.extend(true, [], this.options.data);
			
		} else if (typeof key === 'string' && typeof val === 'undefined') {
			// get one by label
			idx = indexByProp(this.options.data, 'label', key);
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
			idx = indexByProp(this.options.data, 'label', key.label);
			
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
	
	window.jqCharts.StackedBar = StackedBarChart;
	
	// Utility Functions
	
}(window, d3, jQuery, jqCharts.utils));