;(function(window, $, undefined){

  var hasSVG = document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#BasicStructure', '1.1');
  var clipPaths = 0;

  // define the jQuery plugin
  var plugin = $.fn.jqChart = function(type, data, options) {
    var chain = true; // whether to return jQuery or normal Array
    var args = arguments;
    var result = this.map(function(){
      var result;
      var widget = $(this).data('jqchart');

      if (widget instanceof Chart && typeof widget[type] === 'function') {
        // execute widget method
        result = widget[type].apply(widget, Array.prototype.slice.call(args, 1));
      } else {
        // instantiate a new widget
        new Chart(this, type, data, options);
      }
      if (result === undefined || result instanceof $) {
        // return element for chaining
        return this;
      } else {
        // return results in normal array
        chain = false;
        return result;
      }
    });
    if (chain) {
      return result;
    } else {
      // return single results of one element or array of all results
      return result.length > 1 ? result.toArray() : result[0];
    }
  };

  // expose default options
  plugin.options = {};
  plugin.options.global = {
    height: 'auto',
    width: 'auto',
    animationDuration: 2000,
    label: {
      fontFamily: 'Verdana',
      fontSize: 14,
      margin: 10,
      fontColor: '#000',
      x: null,
      y: null
    },
    axis: {
      fontFamily: 'Verdana',
      fontSize: 12,
      fontColor: '#aaa',
      gridColor: '#e2e2e2',
      xAxisMargin: 0,
      yAxisMargin: 0,
      xAxisSpace: 'auto',
      yAxisSpace: 'auto',
      resolution: 5
    },
    frame: {
      backgroundColor: '#fff',
      borderColor: '#ccc',
      paddingTop: 10
    },
    tooltip: {
      enabled: true,
      renderer: tooltipXYDefault,
      fontSize: 12,
      fontFamily: 'Verdana',
      fontWeight: 200,
      fontColor: '#444',
      dotColor: '#676767',
      dotBorderWidth: 0,
      dotBorderColor: '#000',
      padding: 5,
      backgroundColor: '#FFF',
      backgroundOpacity: 0.67
    },
    xGrid: true,
    yGrid: true,
    canZoom: true,
    percentFormat: '.2p',
    numberFormat: ',',
    dateFormat: '%-m/%-d',
    dateParse: '%m/%d/%Y',
    xDate: false
  };


  //
  // global chart constructor, extends itself by type
  //
  function Chart(element, type, data, options) {
    if (!plugin.types[type]) return null;
    this.element = element;
    this.$el = $(element);
    this.type = type;
    this.options = $.extend(true, {}, plugin.options.global, plugin.options[type], options);
    $.extend(true, this, plugin.types[type]);

    this._ = this._ || {}; // instance-specific utilities
    this.$ = this.$ || {}; // instance elements for easy cleanup
    this.$el.data('jqchart', this);

    // build SVG element to contain chart
    this.autoSize();
    this.addSVG();
    this.setData(data);

    // build chart element and any externals (legend, label, axis)
    this.init();

    // render first iteration of chart
    this.prepareUtils();
    this.renderChart();
    if (this.afterRender) this.afterRender();
  }

  Chart.prototype = {

    autoSize: function() {
      this._.height = typeof this.options.height == 'number' ? this.options.height : this.$el.height();
      this._.width = typeof this.options.width == 'number' ? this.options.width : this.$el.width();
    },

    addSVG: function() {
      this.$.svg = d3.select(this.element).append('svg')
        .classed('jqchart-' + this.type, true)
        .attr('height', this._.height)
        .attr('width', this._.width)
        .style('overflow', 'hidden');
    },

    setData: function(data) {
      this._.oldData = $.extend(true, {}, this.data || {});
      this.data = $.extend(true, {}, data);
    },

    value: function(key, val) {
      var idx, newData;

      if (key === undefined) {

        // get all
        return $.extend(true, {}, this.data);

      } else if (typeof key === 'string') {

        // actions by key
        idx = this.data.label.indexOf(key);
        if (val === undefined) {

          // get one
          return idx !== -1 ? this.data.value[idx] : null;

        } else {

          // set one
          if (idx !== -1) {
            newData = $.extend(true, {}, this.data);
            newData.value[idx] = val;
            this.setData(newData);
          }

        }
      } else if (typeof key === 'object') {

        // set all
        this.setData(key);

      }
      this.renderChart();
    }

  };

  // dictionary of chart types
  plugin.types = {};

  //
  // pie charts
  //
  plugin.options.pie = {
    startAngle: 0,
    strokeWidth: 0.7,
    strokeColor: '#FFFFFF',
    innerRadius: 0
  };
  plugin.types.pie = {
    init: function pieInit() {
      this.$.chart = this.$.svg.append('g')
        .call(translate, cleanPx(this._.width / 2), cleanPx(this._.height / 2));
    },
    // build instance specific chart utilities
    prepareUtils: function() {
      var self = this;

      this._.oldData = {};
      this._.zeroData = {};
      this._.pieData = [];
      this._.oldPieData = [];
      this._.outerRadius = Math.min(this._.width/2 - (this.options.label.fontSize * 2), this._.height/2) - this.options.label.margin - this.options.label.fontSize;
      this._.labelRadius = this._.outerRadius + this.options.label.margin;
      this._.startAngle = this.options.startAngle * Math.PI / 180;
      this._.percentFormat = d3.format(this.options.percentFormat);

      // arc builder
      this._.arc = d3.svg.arc()
        .innerRadius(this.options.innerRadius)
        .outerRadius(this._.outerRadius);

      // pie builder
      this._.pie = d3.layout.pie()
        .startAngle(this._.startAngle)
        .endAngle(this._.startAngle + Math.PI * 2)
        .sort(null);

      // label positioners
      this._.labelArcX = d3.svg.arc()
        .innerRadius(this._.labelRadius)
        .outerRadius(this._.labelRadius + this.options.label.fontSize * 3);
      this._.labelArcY = d3.svg.arc()
        .innerRadius(this._.labelRadius)
        .outerRadius(this._.labelRadius + this.options.label.fontSize);
      this._.labelPosition = function(dt) {
        return [
          self._.labelArcX.centroid(dt)[0],
          self._.labelArcY.centroid(dt)[1] + (self.options.label.fontSize / 3)
        ];
      };

      // data color utility
      this._.color = function(d, i) {
        if (self.data.color[i]) {
          return self.data.color[i];
        }
      };

      // arc repositioning animation
      this._.updateSection = function() {
        this.transition()
          .duration(self.options.animationDuration)
          .tween('arcsize', self._.tweenArcSize)
          .each('end', function(){
            d3.select(this).select('text').text(function(d){
              return d.value === 0 ? '' : self._.percentFormat(d.value / self._.total);
            });
          });
      };

      this._.tweenArcSize = function(d, i) {
        var start, end, interpolate;

        if (self._.oldPieData[i]) {
          // preexisting slice, start at current angles
          start = self._.oldPieData[i].startAngle;
          end = self._.oldPieData[i].endAngle;
        } else if (!self._.oldPieData[i] && self._.oldPieData[i-1]) {
          // additional final slice, start at end of previous slice
          start = self._.oldPieData[i-1].endAngle;
          end = self._.oldPieData[i-1].endAngle;
        } else if (!self._.oldPieData[i-1] && self._.oldPieData.length) {
          // additional first slice, start at end of last slice
          start = self._.oldPieData[self._.oldPieData.length-1].endAngle;
          end = self._.oldPieData[self._.oldPieData.length-1].endAngle;
        } else {
          // only slice, start at pie start angle
          start = self._.startAngle;
          end = self._.startAngle;
        }

        interpolate = d3.interpolate({
          startAngle: start,
          endAngle: end
        }, {
          startAngle: d.startAngle,
          endAngle: d.endAngle
        });

        return function(t) {
          var dt = interpolate(t);

          d3.select(this).select('path')
            .attr('d', self._.arc(dt));
          d3.select(this).select('text')
            .call(translate, self._.labelPosition(dt));
        };

      };

    },
    prepareData: function() {
      this._.oldPieData = this._.pieData;
      this.data = fillNewData(this.data, this._.oldData, 0);
      this._.total = d3.sum(this.data.value);
      this._.pieData = this._.pie(this.data.value);
    },
    renderChart: function() {
      var self = this;

      this.prepareData();
      this.$.sections = this.$.chart.selectAll('g')
        .data(this._.pieData, function(d, i){
          return self.data.label[i];
        });

      this.$.sections.transition()
        .call(this._.updateSection);

      var enterGroup = this.$.sections.enter().append('g');

      enterGroup.append('path')
        .classed('jqchart-section', true)
        .classed('jqchart-section-clickable', true)
        .attr('fill', this._.color)
        .attr('stroke', this.options.strokeColor)
        .attr('stroke-width', this.options.strokeWidth);

      enterGroup.append('text')
        .attr('text-anchor', 'middle')
        .call(styleText, this.options.label);

      enterGroup.call(this._.updateSection);

      this.$.sections.selectAll('path')
        .on('mouseover', function(){
          d3.select(this)
            .classed('jqchart-section-active', true);
        })
        .on('mouseout', function(){
          d3.select(this)
            .classed('jqchart-section-active', false);
        })
        .on('click', function(d, a, i){
          triggerEvent('click:data', self, {
            section: i,
            value: d.value,
            percent: d.value / self._.total * 100,
            label: self.data.label[i]
          });
        });
    }
  };

  //
  // funnel charts
  //
  plugin.options.funnel = {
    label: {
      width: 150
    },
    axis: {
      renderer: function(values, i, format) {
        var text = format.number(values[i]);
        // account for dividing by 0
        if (values[i-1] !== 0 && values[i-1] !== undefined) {
          text += ' (' + format.percent(values[i] / values[i-1]) + ')';
        }
        return text;
      }
    }
  };
  plugin.types.funnel = {
    init: function() {
      this.$.chart = this.$.svg.append('g');
      this._.width -= this.options.label.width;
    },
    prepareUtils: function() {
      var self = this;

      this._.scaleX = d3.scale.linear()
        .range([0, this._.width]);
      this._.scaleY = d3.scale.linear()
        .range([0, this._.height]);

      this._.area = d3.svg.area()
        .y(function(d, i){
          return self._.scaleY(i);
        })
        .x0(function(d){
          return self._.scaleX(-d[1]);
        })
        .x1(function(d){
          return self._.scaleX(d[1]);
        });

      this._.emptyArea = d3.svg.area()
        .y(function(d, i){
          return self._.scaleY(i);
        })
        .x0(function(d){
          return self._.scaleX(0);
        })
        .x1(function(d){
          return self._.scaleX(0);
        });

      this._.trapezoid = function(data){
        var output = [];

        for (var i=0, I=data.length; i<I; i++) {
          output.push([
            [
              i, // top of trapezoid
              data.length - (i - 1) // width of top
            ], [
              i + 1, // bottom of trapezoid
              data.length - i // width of bottom
            ]
          ]);
        }

        return output;
      };

      this._.numberFormat = d3.format(this.options.numberFormat);
      this._.percentFormat = d3.format(this.options.percentFormat);

      this._.color = function(d, i) {
        if (self.data.color && self.data.color instanceof Array && self.data.color[i]) {
          return self.data.color[i];
        } else {
          return colorScale(i);
        }
      };

    },
    prepareData: function() {
      this._.trapezoidData = this._.trapezoid(this.data.value);

      this._.scaleX.domain([
        -d3.max(this._.trapezoidData, function(d){
          return d3.max(d, function(d){ return d[1]; });
        }),
        d3.max(this._.trapezoidData, function(d){
          return d3.max(d, function(d){ return d[1]; });
        })
      ]);

      this._.scaleY.domain([
        0,
        this.data.value.length
      ]);
    },
    renderChart: function() {
      var self = this;

      this.prepareData();

      this.$.sections = this.$.chart.selectAll('.jqchart-funnel-group')
        .data(this._.trapezoidData);

      this.$.sections.each(function(d, i){
        d3.select(this).select('.jqchart-funnel-value')
          .text(function(){
            return self._.numberFormat(self.data.value[i]);
          });
      });

      var enterGroup = this.$.sections.enter().append('g')
        .attr('class', 'jqchart-funnel-group')
        .each(function(d, i){
          var yOffset = self._.scaleY(i);
          d3.select(this).call(translate, 0, yOffset);
        });

      enterGroup.append('path')
        .classed('jqchart-section', true)
        .classed('jqchart-section-clickable', true)
        .attr('d', this._.emptyArea)
        .attr('fill', function(){
          return d3.rgb(self._.color.apply(this, arguments)).darker(2);
        })
        .transition()
          .delay(function(d, i){ return (i / self.data.value.length) * 500; })
          .ease(function(t){
            // tornado polygon width & color over time
            // `d = sin( (0.5 + 2n) * PI )`
            // n = number of rotations & limit = [-1 (backside),1 (frontside)]
            return t > 1 ? 1 : Math.abs(Math.sin(1.5 * Math.PI * t));
          })
          .attr('fill', this._.color)
          .duration(this.options.animationDuration - 500)
          .attr('d', this._.area);

      var enterLabels = enterGroup.append('g')
        .each(function(d, i){
          var xOffset = self._.scaleX(-i) + (self._.width / 2) + self.options.label.margin;
          d3.select(this).call(translate, xOffset, (self._.height / self.data.value.length) / 2);
        });

      enterLabels.append('text')
        .attr('class', 'jqchart-funnel-label')
        .text(function(d, i){
          return self.data.label[i];
        }).call(styleText, this.options.label, 'start');

      enterLabels.append('text')
        .attr('class', 'jqchart-funnel-value')
        .attr('y', this.options.axis.fontSize * 1.3)
        .text(function(d, i){
            var text = self.options.axis.renderer.call(window, self.data.value, i, {
              number: self._.numberFormat,
              percent: self._.percentFormat
            });
            return (typeof text === 'string') ? text : '';
        }).call(styleText, this.options.axis, 'start');

      this.$.sections.selectAll('path')
        .on('mouseover', function(){
          d3.select(this)
            .classed('jqchart-section-active', true);
        })
        .on('mouseout', function(){
          d3.select(this)
            .classed('jqchart-section-active', false);
        })
        .on('click', function(d, a, i){
          triggerEvent('click:data', self, {
            section: i,
            value: self.data.value[i],
            label: self.data.label[i]
          });
        });

    }
  };

  //
  // line charts
  //
  plugin.options.line = {
    lineWidth: 3,
    axis: {
      gridAbove: false
    },
    label: {
      x: null,
      y: null
    }
  };
  plugin.types.line = {
    init: framedInit,
    // build instance specific chart utilities
    prepareUtils: function() {
      var self = this;

      // x axis
      xFrameUtils.call(this);

      // y axis
      yFrameUtils.call(this);

      // hover points
      voronoiUtils.call(this);

      // line builder
      this._.line = d3.svg.line()
        .x(function(d){
          return self._.scaleX(self._.getX(d));
        })
        .y(function(d){
          return self._.scaleY(d[1]);
        });
      this._.lineValue = function(d) {
        return self._.line(d.value);
      };

      // new line animation
      this._.addLine = function() {
        if (hasSVG) {
          var length = d3.select(this).node().getTotalLength();
          d3.select(this)
            .attr('stroke-dasharray', length + ' ' + length)
            .attr('stroke-dashoffset', length)
            .transition()
              .duration(self.options.animationDuration)
              .ease('linear')
              .attr('stroke-dashoffset', 0);
          d3.select(this)
              .transition()
              .delay(self.options.animationDuration)
                .attr('stroke-dasharray', 'none');
        }
      };

      // data color utility
      this._.color = function(d, i) {
        if (self.data.color instanceof Array) {
          return self.data.color[i];
        } else if (typeof self.data.color === 'string') {
          return self.data.color;
        } else return '#444';
      };
    },
    // update scale and axis utilities with new domains
    prepareData: function() {
      var self = this;

      // sort line points by x values
      $.each(this.data.value, function(i, points){
        arraySort(points, self._.getX);
      });

      this._.scaleX.domain([
        d3.min(this.data.value, this._.minX),
        d3.max(this.data.value, this._.maxX)
      ]);
      this._.scaleY.domain([0, d3.max(this.data.value, this._.maxY)]);
      this._.axisX.scale(this._.scaleX);
      this._.axisY.scale(this._.scaleY);
      this._.updateAxes();

      this._.lineData = $.map(this.data.label, function(label, i){
        return {
          label: label,
          value: self.data.value[i]
        };
      });
    },
    renderChart: function() {
      var self = this;
      // prepare data and scales for rendering
      this.prepareData();

      // render chart
      this.$.sections = this.$.chart.selectAll('path')
        .data(this._.lineData, function(d){
          return d.label;
        });

      this.$.sections.transition()
        .duration(this.options.animationDuration)
        .attr('d', this._.lineValue);

      this.$.sections.enter().append('path')
        .classed('jqchart-section', true)
        .attr('d', function(d, i){
          d.element = this;
          return self._.lineValue(d, i);
        })
        .attr('stroke', this._.color)
        .attr('fill', 'none')
        .attr('stroke-width', '' + this.options.lineWidth)
        .each(this._.addLine);

      this.$.sections.exit().remove();

      this.updateInteractionLayer();
    },
    updateInteractionLayer: function(){
      var self = this;
      if (!hasSVG) {
        // non-point interactions for old browsers without SVG
        this.$.sections
          .classed('jqchart-section-clickable', true)
          .on('click', function(d, a, i){
            triggerEvent('click:data', self, {
              section: i,
              value: d.value,
              label: self.data.label[i]
            });
          });
      } else {
        // point-specific (voronoi) interactions
        var flattened = $.map(this._.lineData, function(v, i){
          return $.map(v.value, function(vv, ii){
            return {
              point: vv,
              pointIndex: ii,
              section: v.element,
              sectionIndex: i,
              name: v.label
            };
          });
        });

        voronoiUpdate.call(this, flattened);
      }
    },
    renderData: function() {
      this.$.sections.attr('d', this._.lineValue);
      this.updateInteractionLayer();
    },
    afterRender: function() {
      // REMOVED WHILE CONFLICTING WITH EVENTS
      // if (this.options.canZoom) addZoom.call(this);
    }
  };

  //
  // area charts
  //
  plugin.options.area = {
    type: 'stacked', // stacked, layered, or inclusive
    layerOpacity: 0.3,
    lineWidth: 0,
    axis: {
      gridAbove: true
    }
  };
  plugin.types.area = {
    _: {
      getY: function(d) {
        return d.y0 + d.y;
      }
    },
    init: framedInit,
    prepareUtils: function() {
      var self = this;

      // x axis
      xFrameUtils.call(this);

      // y axis
      yFrameUtils.call(this);

      // hover points
      voronoiUtils.call(this);

      // stack builder
      this._.stack = d3.layout.stack()
        .offset('zero')
        .x(function(d){
          return self._.getX(d);
        })
        .y(function(d){
          return d[1];
        });

      if (this.options.type === 'layered') {
        this._.stack.out(function(d, y0, y){
          d.y = y;
          d.y0 = 0;
        });
      } else if (this.options.type === 'inclusive') {
        this._.stack.out(function(d, y0, y){
          d.y = Math.max(y - y0, 0);
          d.y0 = y0;
        });
      }

      // area builder
      this._.area = d3.svg.area()
        .x(function(d){
          return self._.scaleX(self._.getX(d));
        })
        .y0(function(d){
          return self._.scaleY(d.y0);
        })
        .y1(function(d){
          return self._.scaleY(d.y0 + d.y);
        });

      // data color utility
      this._.color = function(d, i) {
        if (self.data.color instanceof Array) {
          return self.data.color[i];
        } else if (typeof self.data.color === 'string') {
          return self.data.color;
        } else return '#444';
      };
    },
    prepareData: function() {
      var self = this;

      // sort line points by x values
      $.each(this.data.value, function(i, points){
        arraySort(points, self._.getX);
      });

      // set new scales based on non-zeroed stack data
      this._.stackData = this._.stack(this.data.value);
      this._.scaleX.domain([
        d3.min(this.data.value, this._.minX),
        d3.max(this.data.value, this._.maxX)
      ]);
      if (this.options.type === 'layered' || this.options.type === 'inclusive') {
        this._.scaleY.domain([
          0,
          d3.max(this._.stackData, this._.maxY)
        ]);
      } else {
        this._.scaleY.domain([
          0,
          d3.max(this._.stackData[this._.stackData.length - 1], this._.getY)
        ]);
      }

      // create a flat line to transition exiting areas towards
      var zeroLine = unique(this.data.value, function(line){
        return $.map(line, function(tuple){ return tuple[0]; });
      });
      zeroLine = $.map(zeroLine, function(x){
        return [[x, 0]]; // double array, to avoid $.map flattening
      });

      // zero out old values to persist them for transitioning to zero line
      this.data = fillNewData(this.data, this._.oldData, function(){
        return zeroLine; // missing areas replaced with zero line
      });
      this._.zeroStack = this._.stack(this.data.value);

      // update axes scales
      this._.axisX.scale(this._.scaleX);
      this._.axisY.scale(this._.scaleY);
      this._.updateAxes();
    },
    renderChart: function() {
      var self = this;

      // prepare data and scales for rendering
      this.prepareData();

      this.$.sections = this.$.chart.selectAll('path')
        .data(this._.stackData);

      this.$.sections.enter().append('path')
        .classed('jqchart-section', true)
        .attr('fill', this._.color)
        .style('fill-opacity', this.options.type == 'layered' ? this.options.layerOpacity : 1)
        .style('stroke', this._.color)
        .style('stroke-width', this.options.lineWidth);

      this.$.sections.transition()
        .duration(this.options.animationDuration)
          .attr('d', function(d, i){
            d.element = this;
            return self._.area(d, i);
          });

      this.$.sections.exit().remove();

      this.updateInteractionLayer();
    },
    updateInteractionLayer: function() {
      var self = this;
      if (!hasSVG) {
        // non-point interactions for old browsers without SVG
        this.$.sections
          .classed('jqchart-section-clickable', true)
          .on('click', function(d, i){
            triggerEvent('click:data', self, {
              section: i,
              value: $.map(self.data.value[i], function(eachValue){
                return [eachValue.slice()];
              }),
              label: self.data.label[i]
            });
          });
      } else {
        // point-specific (voronoi) interactions
        var flattened = $.map(this._.stackData, function(v, i){
          return $.map(v, function(vv, ii){
            return {
              point: [vv[0], vv.y0 + vv.y],
              pointIndex: ii,
              section: v.element,
              sectionIndex: i,
              name: self.data.label[i]
            };
          });
        });

        voronoiUpdate.call(this, flattened);
      }
    },
    renderData: function() {
      this.$.sections.attr('d', this._.area);
    },
    afterRender: function() {
      // REMOVED WHILE CONFLICTING WITH EVENTS
      // if (this.options.canZoom) addZoom.call(this);
    }
  };

  //
  // bar charts
  //
  plugin.options.bar = {
    axis: {
      barSpacing: 0.3,
      gridAbove: false
    },
    tooltip: {
      renderer: tooltipBarDefault
    }
  };
  plugin.types.bar = {
    _: {
      // maximum Y coordinate is based on total of each bar's sections
      maxY: function(d) { return d.total; },
      // disable horizontal zooming and grid
      zoomX: false
    },
    init: framedInit,
    prepareUtils: function() {
      var self = this;

      // x axis
      this._.scaleX = d3.scale.ordinal()
        .rangeRoundBands([0, this._.width], this.options.axis.barSpacing, this.options.axis.barSpacing * 0.75);
      this._.scaleX.range();
      if (this.options.axis.x !== false) {
        this._.axisX = d3.svg.axis().orient('bottom').tickSize(0);
      }
      this._.labelX = function(d){
        return d.label;
      };

      // y axis
      yFrameUtils.call(this);
      if (this.options.axis.y === false) this._.axisY = null;

      // add tooltip elements for hover
      overlayUtils.call(this);

      // convert data for bar section measurements
      this._.getBarData = function(data) {
        var barsData = [];

        // data for each bar
        $.each(data.value, function(sectionI, section){
          var y0 = 0;
          var sectionData = section instanceof Array ? $.extend([], section) : [section];

          // data for each bar section
          sectionData = $.map(sectionData, function(subsectionValue, subsectionI){
            return {
              y0: y0,
              y1: y0 += subsectionValue,
              color: self._.color(sectionI, subsectionI),
              section: sectionI,
              subsection: subsectionI,
              label: data.label[sectionI],
              total: sectionData.length
            };
          });
          sectionData.total = sectionData[sectionData.length-1].y1;
          sectionData.label = data.label[sectionI];
          barsData.push(sectionData);
        });

        return barsData;
      };

      // data color utility
      this._.color = function(sectionI, subsectionI) {
        var barColor;
        var barSections = self.data.value[sectionI].length || 1;

        if (self.data.color instanceof Array && self.data.color[subsectionI]) {
          barColor = self.data.color[sectionI];
        } else {
          barColor = colorScale(sectionI);
        }

        if (typeof barColor === 'string') {
          return d3.rgb(barColor).brighter(subsectionI / barSections).toString();
        } else if (barColor instanceof Array && barColor[subsectionI]) {
          return barColor[subsectionI];
        }
      };

      // bar update transition
      this._.updateSection = function(sectionData, i, isInteractive) {
        d3.select(this).transition()
          .duration(self.options.animationDuration)
            .attr('transform', function(d){
              return 'translate('+cleanPx(self._.scaleX(d.label))+',0.5)';
            });

        var section = d3.select(this).selectAll('rect')
          .data(sectionData);

        section.call(self._.updateSubsection);

        section.enter().append('rect')
          .attr('fill', isInteractive ? self.options.frame.backgroundColor : function(d){ return d.color; })
          .attr('fill-opacity', isInteractive ? 0.1 : 1)
          .attr('height', 0)
          .attr('y', function(){ return self._.height; })
          .attr('width', function(){
            return self._.scaleX.rangeBand();
          })
          .call(self._.updateSubsection, true);

        section.call(self._.updateSubsection);

        section.exit().remove();
      };
      this._.updateSubsection = function() {
        this.transition()
          .duration(self._.hasRendered ? self.options.animationDuration : self.options.animationDuration / 2)
          .delay(function(d){
            if (self._.hasRendered) return 0;
            return d.section / self._.barsData.length * (self.options.animationDuration / 2);
          })
          .attr('width', function(){
            return self._.scaleX.rangeBand();
          })
          .attr('height', function(d){
            return self._.scaleY(d.y0) - self._.scaleY(d.y1);
          })
          .attr('y', function(d){
            return self._.scaleY(d.y1);
          });
      };
    },
    prepareData: function() {
      this._.barsData = this._.getBarData(this.data);
      this._.scaleX.domain($.map(this._.barsData, this._.labelX));
      this._.scaleY.domain([0, d3.max(this._.barsData, this._.maxY)]);
      this._.axisX && this._.axisX.scale(this._.scaleX);
      this._.axisY && this._.axisY.scale(this._.scaleY);
      this._.updateAxes();
    },
    renderChart: function() {
      var self = this;
      var oldBandWidth = this._.scaleX.rangeBand();
      var sections, interactive;

      // prepare data and scales for rendering
      this.prepareData();

      sections = this.$.chart.selectAll('g')
        .data(this._.barsData, this._.labelX);
      interactive = this.$.interactions.selectAll('g')
        .data(this._.barsData, this._.labelX);

      sections.each(this._.updateSection);
      interactive.each(function(d, i){
        self._.updateSection.call(this, d, i, true);
      });

      sections.enter().append('g')
        .attr('transform', function(d){
          return 'translate('+cleanPx(self._.scaleX(d.label))+',0.5)';
        })
        .each(this._.updateSection);
      interactive.enter().append('g')
        .attr('transform', function(d){
          return 'translate('+cleanPx(self._.scaleX(d.label))+',0.5)';
        })
        .each(function(d, i){
          self._.updateSection.call(this, d, i, true);
        });

      // attach sections to data and add appropriate classes
      sections.selectAll('rect')
        .each(function(d){
          d.element = this;
        })
        .classed('jqchart-section', true)
        .classed('jqchart-section-clickable', true);

      // add events to interaction layer
      interactive.selectAll('rect')
        .on('click', function(d, a, i){
          triggerEvent('click:data', self, {
            section: i,
            subsection: a,
            value: self.data.value[d.section],
            label: self.data.label[i]
          });
        })
        .on('mouseover', function(d){
          // toggle bar color on
          d3.select(this)
            .classed('jqchart-section-active', true)
            .style('fill', function(){
              return d3.rgb(self._.color(d.section, d.subsection)).darker();
            });

          // update the tooltip
          showTooltip.call(self,
            self._.scaleX(d.label), // x position
            self._.scaleY(d.y1), // y position
            { // rendering function arguments
              label: d.label,
              value: d.y1 - d.y0,
              sectionIndex: d.section,
              subsectionIndex: d.subsection
            }
          );
        })
        .on('mouseout', function(d){
          // toggle bar color off
          d3.select(this)
            .classed('jqchart-section-active', false)
            .style('fill', function(){
              return self._.color(d.section, d.subsection);
            });

          // move tooltip out
          if (self.options.tooltip.enabled) {
            self.$.focus.call(translate, -100, -100);
          }
        });

      // remove old sections that are now gone
      sections.exit().selectAll('rect').call(removeSection);
      interactive.exit().selectAll('rect').call(removeSection);

      function removeSection() {
        if (!this || !this.length) return;
        d3.select(this).transition()
          .duration(self.options.animationDuration)
            .attr('y', 170)
            .attr('height', 0)
            .attr('width', 0)
            .call(translate, oldBandWidth / 2, 0)
            .remove();
      }

      this.$.sections = sections;
    },
    renderData: function() {
      var self = this;

      this.$.sections.selectAll('rect')
        .attr('height', function(d){
          return self._.scaleY(d.y0) - self._.scaleY(d.y1);
        })
        .attr('y', function(d){
          return self._.scaleY(d.y1);
        });
    },
    afterRender: function() {
      this._.hasRendered = true;
      // REMOVED WHILE CONFLICTING WITH EVENTS
      // if (this.options.canZoom) addZoom.call(this);
    }
  };


  //
  // shared chart drawing functions
  //

  // shared canvas initialization that creates a frame with axes and labels
  function framedInit() {
    // build target for chart
    this.$.frame = this.$.svg.append('g');
    this._.marginLeft = this._.marginRight = this._.marginTop = this._.marginBottom = 0.5;

    // append bg first for layering reasons
    if (this.options.frame.backgroundColor) {
      this.$.bg = this.$.frame.append('rect')
        .attr('fill', this.options.frame.backgroundColor);
    }

    // add margin elements
    addLabels.call(this);

    if (this.options.axis.gridAbove) {
      this.$.chart = this.$.frame.append('g').attr('class', 'jqchart-chart');
    }

    addAxes.call(this);

    // set heights and widths now that margin elements have been added
    this._.width -= Math.floor(this._.marginLeft + this._.marginRight);
    this._.height -= Math.floor(this._.marginTop + this._.marginBottom);

    if (this.$.bg) {
        this.$.bg.attr('width', this._.width)
          .attr('height', this._.height);
    }

    // append outline last to go over axes
    this.$.frame.append('rect')
      .attr('stroke-width', 1)
      .attr('fill', 'none')
      .attr('stroke', this.options.frame.borderColor)
      .attr('width', hasSVG ? this._.width : this._.width + 1)
      .attr('height', hasSVG ? this._.height : this._.height + 1)
      .call(translate, hasSVG ? 0 : -1, 0.5);

    if (!this.options.axis.gridAbove) {
      this.$.chart = this.$.frame.append('g').attr('class', 'jqchart-chart');
    }

    // put frame into place
    this.$.frame.call(translate, this._.marginLeft, this._.marginTop + 0.5);


    // clip chart viewing window to frame
    ++clipPaths;
    this.$.frame.append('clipPath')
      .attr('id', 'clip-path-' + clipPaths)
      .append('rect')
        .attr('fill', 'none')
        .attr('width', this._.width - 1)
        .attr('height', this._.height - 1)
        .call(translate, 0, 1);
    this.$.chart.attr('clip-path', 'url(#clip-path-' + clipPaths + ')');
  }

  // add chart labels
  function addLabels() {
    if (!this.options.label.x && !this.options.label.y) return;

    var descenderSize = Math.ceil(this.options.label.fontSize / 3);

    if (this.options.label.x) {
      this.$.svg.append('text')
        .call(styleText, this.options.label)
        .text(this.options.label.x)
        .attr('x', this._.width / 2)
        .attr('y', this._.height - descenderSize);

      this._.marginBottom += this.options.label.fontSize + descenderSize + this.options.label.margin;
    }

    if (this.options.label.y) {
      this.$.svg.append('text')
        .call(styleText, this.options.label)
        .text(this.options.label.y)
        .attr('x', this._.height / -2)
        .attr('y', this.options.label.fontSize)
        .attr('transform', 'rotate(-90, 0, 0)');

      this._.marginLeft += (this.options.label.fontSize * 2) + this.options.label.margin;
    }
  }

  // add chart axes
  function addAxes() {
    var self = this;
    var descenderSize = Math.ceil(this.options.axis.fontSize / 3);

    var xAxisSpace = typeof this.options.axis.xAxisSpace === 'number' ? this.options.axis.xAxisSpace : this.options.axis.fontSize + descenderSize;
    var yAxisSpace = typeof this.options.axis.yAxisSpace === 'number' ? this.options.axis.yAxisSpace : this.options.axis.fontSize * 4;

    this._.marginBottom += xAxisSpace + this.options.axis.xAxisMargin;
    this._.marginTop += this.options.axis.fontSize;
    this.$.axisX = this.$.frame.append('g')
      .attr('class', 'jqchart-axis-x jqchart-axis')
      .call(translate, 0, this._.height - this._.marginTop - this._.marginBottom);

    this._.marginRight += this.options.axis.fontSize * 2;
    this._.marginLeft += yAxisSpace + this.options.axis.yAxisMargin;
    this.$.axisY = this.$.frame.append('g')
      .attr('class', 'jqchart-axis-y jqchart-axis')
      .call(translate, 0, 0);

    this._.styleAxis = function(axis) {
      axis.selectAll('path')
        .attr('fill', 'none')
        .attr('stroke-width', 0);
      axis.selectAll('line')
        .attr('fill', 'none')
        .attr('stroke', self.options.axis.gridColor)
        .attr('shape-rendering', 'crispEdges');
      axis.selectAll('text').call(styleText, self.options.axis);
    };

    this._.updateAxes = function() {
      if (self.$.axisX && self._.axisX) {
        self.$.axisX.call(self._.axisX).call(self._.styleAxis)
          .selectAll('text')
            .call(translate, 0, self.options.axis.xAxisMargin);
      }
      if (self.$.axisY && self._.axisY) {
        self.$.axisY.call(self._.axisY).call(self._.styleAxis)
          .selectAll('text')
            .call(translate, -self.options.axis.yAxisMargin, 0);
      }
    };
  }
  function xFrameUtils() {
    var self = this;

    if (this.options.xDate) {
      this._.dateParse = d3.time.format(this.options.dateParse).parse;
      this._.getX = function(d) {
        return self._.dateParse(d[0]);
      };
    } else {
      if (!this._.numberFormat) {
        this._.numberFormat = d3.format(this.options.numberFormat);
      }
      this._.getX = this._.getX || rawX;
    }
    this._.minX = this._.minX || function(d){ return d3.min(d, self._.getX); };
    this._.maxX = this._.maxX || function(d){ return d3.max(d, self._.getX); };

    this._.scaleX = this.options.xDate ? d3.time.scale() : d3.scale.linear();
    this._.scaleX.range([0, this._.width]);
    this._.axisX = d3.svg.axis().orient('bottom')
      .tickPadding(hasSVG ? 6 : 10)
      .ticks(this.options.axis.resolution);
    if (this.options.xDate) {
      this._.formatX = d3.time.format(this.options.dateFormat);
    } else {
      this._.formatX = this._.numberFormat;
    }
    this._.axisX.tickFormat(this._.formatX);
    if (this.options.xGrid) {
      this._.axisX.tickSize(-this._.height);
    } else {
      this._.axisX.tickSize(0);
    }
  }
  function yFrameUtils() {
    var self = this;

    this._.getY = this._.getY || rawY;
    this._.maxY = this._.maxY || function(d){ return d3.max(d, self._.getY); };
    if (!this._.numberFormat) {
      this._.numberFormat = d3.format(this.options.numberFormat);
    }

    this._.scaleY = d3.scale.linear()
      .rangeRound([this._.height, this.options.frame.paddingTop]);
    this._.axisY = d3.svg.axis().orient('left')
      .tickPadding(4)
      .ticks(6)
      .tickFormat(this._.numberFormat);
    if (this.options.yGrid) this._.axisY.tickSize(-this._.width);
  }

  // adding zooming capabilities to a frame
  function addZoom() {
    if (!hasSVG) return;

    var self = this;

    this._.zoomed = function() {
      var t = d3.event.translate;
      var s = d3.event.scale;

      // limit panning to chart edge based on scale(s) and attempted coords (t)
      if (self._.zoomX !== false) {
        t[0] = Math.max(-self._.width * (s-1), Math.min(0, t[0]));
      }
      if (self._.zoomY !== false) {
        t[1] = Math.max(-self._.height * (s-1), Math.min(0, t[1]));
      }
      self._.zoom.translate(t);

      self._.updateAxes();
      self.renderData();
    };
    this._.zoom = d3.behavior.zoom();

    // allow zooming to be limited to a single axis
    if (this._.zoomX !== false) this._.zoom.x(this._.scaleX);
    if (this._.zoomY !== false) this._.zoom.y(this._.scaleY);

    // no zooming out, zooming in up to a scale limit
    this._.zoom.scaleExtent([1, 20])
      .on('zoom', this._.zoomed);

    // create a hidden layer to detect zoom events
    var zoomTgt = this.$.frame.append('rect')
      .attr('fill', 'none')
      .attr('width', this._.width)
      .attr('height', this._.height)
      .attr('pointer-events', 'all')
      .style('cursor', 'move')
      .style('display', 'none')
      .call(this._.zoom)
      .node();

    // make the chart element focusable and remove focus outline
    $(this.element)
      .css('outline', 'none')
      .attr('tabindex', 0);

    // toggle zoom functionality by hiding/showing zoom target based on focus
    $(this.element).on('focus blur', function(){
      $(zoomTgt).toggle(self.element === window.document.activeElement);
    });
  }

  // adding hover capabilities to nearest point using voronoi diagram
  function voronoiUtils() {
    var self = this;
    if (!hasSVG) return;

    this._.voronoi = d3.geom.voronoi()
      .x(function(d){
        return self._.scaleX(self._.getX(d.point)) + (0.01 * (Math.random() - 0.5));
      })
      .y(function(d){
        return self._.scaleY(d.point[1]);
      })
      .clipExtent([[0, 0],[this._.width, this._.height]]);

    tooltipUtils.call(this, true);

    // add layer group for interaction targets
    this.$.interactions = this.$.frame.append('g').attr('class', 'jqchart-hover-overlay');
  }

  // adding hover capabilities to chart items by recreating them in overlay
  function overlayUtils() {
    var self = this;
    if (!hasSVG) return;

    tooltipUtils.call(this, false);

    // add layer group for interaction targets
    this.$.interactions = this.$.frame.append('g').attr('class', 'jqchart-hover-overlay');
  }

  // add the tooltip popup
  function tooltipUtils(hasPoint) {
    if (!this.options.tooltip.enabled) return;
    
    this.$.focus = this.$.frame.append('g').call(translate, -100, -100);

    this.$.focus.append('rect')
      .style('fill', this.options.tooltip.backgroundColor)
      .style('opacity', this.options.tooltip.backgroundOpacity);

    if (hasPoint) {
      // tooltip dot
      this.$.focus.append('circle')
        .attr('r', 3.5)
        .style('stroke', this.options.tooltip.dotBorderColor)
        .style('stroke-width', this.options.tooltip.dotBorderWidth)
        .style('fill', this.options.tooltip.dotColor);
    }

    // tooltip top line
    this.$.focus.append('text')
      .attr('class', 'jqchart-hover-title')
      .attr('y', this.options.tooltip.fontSize * -2.5)
      .call(styleText, this.options.tooltip);

    // tooltip bottom line
    this.$.focus.append('text')
      .attr('class', 'jqchart-hover-coords');
      
  }
  // tooltip default renderer: bar charts
  function tooltipBarDefault(target) {
    return [
      target.label,
      target.value
    ];
  }

  // tooltip default renderer: line and area charts
  function tooltipXYDefault(target) {
    return [
        target.label,
        target.xFormatted + ' - ' + target.y
      ];
  }

  // update voronoi interaction layers based on flat array of point objects
  function voronoiUpdate(flattenedData) {
    var self = this;

    if (this.$.voronoi) this.$.voronoi.remove();
    this.$.voronoi = this.$.interactions.selectAll('path')
      .data(this._.voronoi(flattenedData));

    this.$.voronoi.enter().append('path')
      .classed('jqchart-section-clickable', true)
      .style('fill', this.options.frame.backgroundColor)
      .style('fill-opacity', 0.1)
      // .style('stroke', 'blue').style('stroke-opacity', 0.2) // used for debugging hover positions
      .attr('d', function(d) {
        if (d.length > 1)
          return 'M' + d.join('L') + 'Z';
      })
      .on('mouseover', function(d){
        // toggle line color on
        d3.select(d.point.section)
          .classed('jqchart-section-active', true)
          .style('stroke', function(dd){
              return d3.rgb(self._.color(dd.value, d.point.sectionIndex)).darker();
            });

        // toggle area color on
        if (self.type === 'area') {
          d3.select(d.point.section)
            .style('fill', function(dd){
              return d3.rgb(self._.color(dd.value, d.point.sectionIndex)).darker();
            });
        }

        // update the tooltip
        showTooltip.call(self,
          self._.scaleX(self._.getX(d.point.point)), // x position
          self._.scaleY(d.point.point[1]), // y position
          { // rendering function arguments
            label: d.point.name,
            x: self._.getX(d.point.point),
            y: d.point.point[1],
            xFormatted: self._.formatX(self._.getX(d.point.point)),
            sectionIndex: d.point.sectionIndex,
            pointIndex: d.point.pointIndex
          }
        );
      })
      .on('mouseout', function(d){
        // toggle line color off
        d3.select(d.point.section)
          .classed('jqchart-section-active', false)
          .style('stroke', function(dd){
            return self._.color(dd.value, d.point.sectionIndex);
          });

        // toggle area color off
        if (self.type === 'area') {
          d3.select(d.point.section)
            .style('fill', function(dd){
              return self._.color(dd.value, d.point.sectionIndex);
            })
            .style('fill-opacity', self.options.type == 'layered' ? self.options.layerOpacity : 1);
        }

        // move tooltip out
        if (self.options.tooltip.enabled) {
          self.$.focus.call(translate, -100, -100);
        }
      })
      .on('click', function(d){
        triggerEvent('click:data', self, {
          section: d.point.sectionIndex,
          point: d.point.pointIndex,
          value: d.point.point,
          label: d.point.name
        });
      });

    this.$.voronoi.exit().remove();
  }

  // tooltip bar rendering on mouse over
  function showTooltip(tooltipX, tooltipY, renderArgs) {
    if (!this.options.tooltip.enabled) return;

    var self = this;
    var pad = this.options.tooltip.padding;
    var lineHeight = this.options.tooltip.fontSize * 1.5;
    var textX = 0;
    var textY = this.options.tooltip.fontSize;

    // get tooltip text, calling line renderer with point data
    var tooltipText = this.options.tooltip.renderer.call(window, renderArgs);
    
    if (!(tooltipText instanceof Array)) tooltipText = [tooltipText];

    // account for number of lines in vertical offset
    textY *= -1.5 * tooltipText.length + 0.5;

    // account for hitting the edge
    textX = (tooltipX / this._.width) * -50 + 25;
    if (tooltipY + textY < 0 + this._.marginTop) {
      textY = this.options.tooltip.fontSize + 5;
    }

    // remove old text
    this.$.focus.selectAll('text').remove();

    // render each text line
    $.each(tooltipText, function(lineI){
      self.$.focus.append('text')
        .classed('jqchart-tooltip-line-' + lineI, true)
        .attr('x', textX)
        .attr('y', textY + (lineHeight * lineI))
        .call(styleText, self.options.tooltip, 'left')
        .text(this);
    });

    var textWidth = Math.max.apply(null, $.map(this.$.focus.selectAll('text')[0], function(text){
      return text.getBoundingClientRect().width;
    }));

    this.$.focus.selectAll('rect')
      .attr('height', lineHeight * tooltipText.length - (lineHeight / 2) + pad * 2)
      .attr('width', textWidth + (2 * pad))
      .call(translate, textX - pad, textY - (self.options.tooltip.fontSize/1.3) - pad);

    // move tooltip
    this.$.focus.call(translate, tooltipX, tooltipY);
  }

  //
  // SVG helpers
  //

  // offset a number by 0.5 to align borders with screen pixels
  // https://groups.google.com/forum/#!topic/d3-js/q1LXpR47xqU
  function cleanPx(px) { return Math.ceil(px) - 0.5; }

  // translate a selection by x/y properties
  function translate(element, x, y) {
    // overloaded, in case x,y is passed as [x,y] by d3
    if (x instanceof Array) { y = x[1]; x = x[0]; }
    element.attr('transform', 'translate('+x+','+y+')');
  }

  // style a text selection based on text options object
  function styleText(label, options, anchor) {
    label.attr('text-anchor', anchor || 'middle')
      .style('font-family', options.fontFamily)
      .style('font-weight', options.fontWeight || 'normal')
      .style('font-size', options.fontSize + 'px')
      .attr('fill', options.fontColor);
  }

  // trigger a jquery event on the chart
  function triggerEvent(type, chart, value) {
    var ev = $.Event(type, d3.event);
    ev.type = type;
    chart.$el.trigger(ev, [value, chart.$el]);
  }

  //
  // Data helpers
  //
  var colorScale = d3.scale.category20();
  function rawX(d) { return d[0]; }
  function rawY(d) { return d[1]; }

  // Fill exiting labels with the value provided in fillValue
  // fillValue can be a flat value or a function, passed args: oldValue, index
  function fillNewData(newData, oldData, fillValue) {
    var i, I;
    var tgtData = $.extend(true, {}, newData);

    if (!oldData.label) return tgtData;
    for (i=0, I=oldData.label.length; i<I; i++) {
      // value is labelled and missing from new data
      if (oldData.label[i] && tgtData.label.indexOf(oldData.label[i]) === -1) {
        tgtData.label.splice(i, 0, oldData.label[i]);
        tgtData.value.splice(i, 0, resolve(fillValue, [oldData.value[i], i], tgtData));
      }
    }

    return tgtData;
  }

  // sort an array of tuples by their x value
  function arraySort(array, getter) {
    if (getter === undefined) getter = rawX;
    array.sort(function(a, b){
      return getter(a) < getter(b) ? -1 : 1;
    });
  }


  //
  // Utility helpers
  //

  // Resolve the first argument to a value.
  // For functions, execute the function with all arguments in array
  // `args` and the context (this) of `context`
  // For everything else, return the value.
  function resolve(val, args, context) {
    if (typeof val === 'function') {
      return val.apply(context, args);
    } else {
      return val;
    }
  }

  // Get the unique values within an array.  Getter can be a mapping function
  // to extract values from the source array.
  function unique(array, getter) {
    var results = [];
    if (typeof getter === 'function') {
      array = $.map(array, getter);
    }
    $.each(array, function(index, value){
      if (results.indexOf(value) === -1) {
        results.push(value);
      }
    });
    return results;
  }

}(this, jQuery));
