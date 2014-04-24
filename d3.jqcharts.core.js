;(function(window, d3, $){
	
	var jqCharts = window.jqCharts = {
		utils: {}
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
	
}(window, d3, jQuery));