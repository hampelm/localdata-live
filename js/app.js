/*global Firebase, L, cartodb, moment */

$(function(){
  var buses = {};

  var map = L.map('map').setView([37.78102667641841, -122.41928100585938], 14);
  var baseLayer = L.tileLayer('http://a.tiles.mapbox.com/v3/matth.map-n9bps30s/{z}/{x}/{y}.png');
  map.addLayer(baseLayer);

  // Add economic layer
  //cartodb.createLayer(map, 'http://localdata.cartodb.com/api/v2/viz/4619a2c4-263c-11e4-a26e-0e73339ffa50/viz.json')
  //   .addTo(map)
  //   .done(function(layer){
  //      console.log("Done");
  //      layer.setZIndex(1);

  //      // Hide / show the money layer
  //      var shown = true;
  //      $('.tab-money .toggle').click(function(event) {
  //        console.log("Clicked");
  //        event.preventDefault();
  //        if (shown) {
  //          layer.hide();
  //        } else {
  //          layer.show();
  //        }
  //        $(this).find('.icon').toggleClass('ion-ios7-eye');
  //        $(this).find('.icon').toggleClass('ion-ios7-eye-outline');
  //        shown = !shown;
  //      });
  //   });

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


  // Add permits layer
  // cartodb.createLayer(map, {
  //   user_name: 'localdata',
  //   type: 'cartodb',
  //   sublayers: [{
  //     sql: "SELECT * FROM san_francisco_street_permits",
  //     cartocss: '#table_name {marker-fill: #58aeff; marker-line-color: #daedff; marker-line-width:2; }'
  //   }]
  // })
  // .addTo(map)
  // .done(function(layer) {
  //   layer.setZIndex(2);
  //   addTimeSlider(layer.getSubLayer(0));
  // });


  // Graph for permit data
  var sql = cartodb.SQL({ user: 'localdata' });
  sql.execute("SELECT to_char(approved_date, 'YYYY-MM'), count(*) FROM san_francisco_street_permits group by to_char(approved_date, 'YYYY-MM') ORDER BY to_char(approved_date, 'YYYY-MM') ASC")
    .done(function(data) {
      var graph = new Rickshaw.Graph({
        series: [ { data: [ { x: 0, y: 2 }, { x: 1, y: 4 } ...
        renderer: 'area',
        element: document.querySelector('#graph')
      });

      graph.render();
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
      opacity: 100
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
