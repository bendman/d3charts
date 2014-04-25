;(function(window, d3, $){
	
	var jqCharts = window.jqCharts = {
		utils: {},
		common: {}
	};

	// search an array of objects by property and value, return indexOf
	jqCharts.utils.indexByProp = function(a, prop, val) {
		for (var i=0, I=a.length; i<I; i++) {
			if (a[i][prop] === val) return i;
		}
		return -1;
	};

	jqCharts.utils.cleanPx = function(num) {
		return Math.ceil(num) - 0.5;
	};

	jqCharts.utils.colorScale = d3.scale.category20();

	jqCharts.common.value = function(key, val) {
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
				this.options.data.label[idx] = key.label;
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
	}
	
}(window, d3, jQuery));