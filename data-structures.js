var data = {};

// Pie
data.pie = {
	value: [ 3230,			1762,			881 ],
	label: [ 'Renewed',		'Not Renewed',	'Outstanding' ],
	color: [ '#F5B961',		'#149195',		'#DC4740']
};

// Percentage Donut
data.percentDonut = {
	value: 25,
	color: '#BED8D9'
};

// Bar (single)
data.bar = {
	value: [ 14,			7,				5 ],
	label: [ 'Message 1',	'Message 1',	'Message 3'],
	color: [ '#C2D8D6',		'#EEDDC1',		'#EE8F89' ]
};

// Bar (stacked)
data.barStacked = {
	value: [ [14,		4],			[7,			7],			[5,			2] ],
	label: [ 'Message 1',			'Message 1',			'Message 3'],
	color: [ ['#C2D8D6','#159097'],	['#EEDDC1',	'#EAA337'],	['#EE8F89',	'#D13E37'] ]
};

// Line


// Sankey
data.sankey = {
	value: 	[ [10, 80, 110],	[70, 20, 10],	[5, 45, 20] /* 	null,		null,			null*/ ],
	target:	[ [3, 4, 5], 		[2, 3, 5],		[3, 4, 5]	/*	null,		null,			null*/ ],
	label:	[ 'Nuclear', 		'Geothermal', 	'Conversion',	'Waste',	'Residential', 	'Commercial' ],
	color:	[ '#CD4039',		'#E76B61',		'#DC4740',	'#F6B863',	'#F6E097',		'#149195']
};

// Funnel
data.funnel = {
	value: 	[ 64284,				62439,					44439,				32192,				2872 ],
	label:	[ 'Messages Sent', 		'Messages Delivered', 	'Messages Opened',	'Links Clicked',	'Renewed' ],
	color:	[ '#E76B61',			'#DC4740',				'#F6B863',			'#F6E097',			'#149195']
};