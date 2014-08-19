/*global Firebase, L, cartodb, moment, Rickshaw */

$(function(){
  var buses = {};

  var map = L.map('map').setView([37.78102667641841, -122.41928100585938], 14);
  var baseLayer = L.tileLayer('http://a.tiles.mapbox.com/v3/matth.map-n9bps30s/{z}/{x}/{y}.png');
  map.addLayer(baseLayer);

  // Add economic layer
  cartodb.createLayer(map, 'http://localdata.cartodb.com/api/v2/viz/4619a2c4-263c-11e4-a26e-0e73339ffa50/viz.json')
     .addTo(map)
     .done(function(layer){
        layer.setZIndex(1);

        // Hide / show the money layer
        var shown = true;
        $('.tab-money .toggle').click(function(event) {
          console.log("Clicked");
          event.preventDefault();
          if (shown) {
            layer.hide();
          } else {
            layer.show();
          }
          $(this).find('.icon').toggleClass('ion-ios7-eye');
          $(this).find('.icon').toggleClass('ion-ios7-eye-outline');
          shown = !shown;
        });
     });

  function changeLegend(start, end) {
    var startDate = moment(start);
    var endDate = moment(end);
    $('#legend').html(startDate.format('MMM YYYY') + " - " + endDate.format('MMM YYYY'));
  }

  function addTimeSlider(sublayer) {
     var sql = cartodb.SQL({ user: 'localdata' });
     // fetch time range
     sql.execute('select max(approved_date), min(approved_date) from san_francisco_street_permits', function(data) {
       var range = data.rows[0];
       var max = new Date(range.max).getTime();
       var min = new Date(range.min).getTime();

       // update slider with range
       $("#slider").slider({
          range: true,
          min: min,
          max: max,
          values: [ min , (min + max)/2 ],
          change: function(event, ui) {
            // give feedback to the user on slide change
            changeLegend(ui.values[0], ui.values[1]);
          },
          stop: function( event, ui ) {
            // when user selects the dates, update the layer with the range
            var start = new Date(ui.values[0]).toISOString();
            var end = new Date(ui.values[1]).toISOString();

            // build sql
            sublayer.setSQL("select * from san_francisco_street_permits where approved_date >= '" + start + "' and approved_date <= '" + end + "'");
          }
        });
        changeLegend(min, (min + max)/ 2);
     });
  }


  // Add permits slider
  cartodb.createLayer(map, {
    user_name: 'localdata',
    type: 'cartodb',
    sublayers: [{
      sql: "SELECT * FROM san_francisco_street_permits",
      cartocss: '#table_name {marker-fill: #58aeff; marker-line-color: #daedff; marker-line-width:2; }'
    }]
  })
  .addTo(map)
  .done(function(layer) {
    layer.setZIndex(2);
    addTimeSlider(layer.getSubLayer(0));
  });

  // Set up for SQL queries
  var sql = cartodb.SQL({ user: 'localdata' });


  // Count permits by census block
  sql.execute("SELECT acs.b19013e1, acs.geoid_long,  COUNT(*) as count FROM acs_2012_income_blockgroups_shp as acs, san_francisco_street_permits as permits WHERE ST_Contains(acs.the_geom, permits.the_geom) GROUP BY acs.b19013e1, acs.geoid_long ORDER BY count DESC; ")
    .done(function(data) {
      console.log("Got permit -- area data", data);
      _.each(data.rows, function(row) {
        $('#censustable').append('<tr><td>' + row.geoid_long + '</td><td>$' + row.b19013e1 + '</td><td>' + row.count + '</td></tr>');
      });
    });



  // Graph for permit data
  sql.execute("SELECT to_char(approved_date, 'YYYY-MM'), count(*) FROM san_francisco_street_permits group by to_char(approved_date, 'YYYY-MM') ORDER BY to_char(approved_date, 'YYYY-MM') ASC")
    .done(function(data) {
      var prepped = [];
      console.log(data.rows);
      _.each(data.rows, function(row, index) {
        prepped.push({
          x: index,
          y: row.count
        });
      });

      var graph = new Rickshaw.Graph({
        series: [{
          data: prepped,
          color: '#daedff'
        }],
        renderer: 'area',
        element: document.querySelector('.tab-permits .graph')
      });
      graph.render();

      var hoverDetail = new Rickshaw.Graph.HoverDetail( {
        graph: graph,
        formatter: function(series, x, y) {
          var month = data.rows[x - 1].to_char;
          return month + '<br>' + y + ' permits';
        }
      });
  });

  // Bus stuff ================

  var transitRef = new Firebase('https://publicdata-transit.firebaseio.com/');
  var f = transitRef.child("sf-muni/vehicles").limit(200);

  function newBus(b) {
    var bus = b.val();
    var marker = L.circleMarker([bus.lat, bus.lon], {
      radius: 4,
      fillColor: '#f15a24',
      color: '#fcf5f0',
      weight: 2,
      opacity: 1,
      fillOpacity: 1
    }).addTo(map).bringToFront();
    buses[b.name()] = marker;
  }

  // New buses
  f.once("value", function (s) {
    s.forEach(function (b) {
      newBus(b);
      // console.log("New bus", b.val(), b.name());
    });
  });

  // When the bus moves
  f.on("child_changed", function (b) {
    if(!buses[b.name()]) {
      newBus(b);
      return;
    }
    var bus = b.val();
    buses[b.name()].setLatLng(new L.LatLng(bus.lat, bus.lon)).bringToFront();
    // console.log("changed", b.val(), b.name());
  });

  // When the bus goes away
  f.on("child_removed", function (b) {
    if(!buses[b.name()]) {
      return;
    }
    map.removeLayer(buses[b.name()]);
  });

});
