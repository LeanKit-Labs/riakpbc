require( './setup.js' );

var Balancer = require( '../lib/balancer' );

var nodes = [
	{ host: '127.0.0.1', port: 8087 },
	{ host: '127.0.0.1', port: 8088 },
	{ host: '127.0.0.1', port: 8089 }
];

describe( 'Balancer', function() {

	it( 'iterates through a list and starts over when it reaches the end', function( done ) {

		var balancer = new Balancer( { nodes: nodes } );
		expect( balancer.next() ).to.have.property( 'port', 8087 );
		expect( balancer.next() ).to.have.property( 'port', 8088 );
		expect( balancer.next() ).to.have.property( 'port', 8089 );
		expect( balancer.next() ).to.have.property( 'port', 8087 );
		done();
	} );
} );
