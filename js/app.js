/*global Firebase, L */

$(function(){
  var buses = {};

  var map = L.map('map').setView([37.79752, -122.37889], 14);
  var baseLayer = L.tileLayer('http://a.tiles.mapbox.com/v3/matth.map-pzt2g69t/{z}/{x}/{y}.png');
  map.addLayer(baseLayer);

  var transitRef = new Firebase('https://publicdata-transit.firebaseio.com/');
  var f = transitRef.child("sf-muni/vehicles").limit(200);

  function newBus(b) {
    var bus = b.val();
    var marker = L.marker([bus.lat, bus.lon]).addTo(map);
    buses[b.name()] = marker;
  }

  // New buses
  f.once("value", function (s) {
    s.forEach(function (b) {
      newBus(b);
      console.log("New bus", b.val(), b.name());
    });
  });

  // When the bus moves
  f.on("child_changed", function (b) {
    if(!buses[b.name()]) {
      newBus(b);
      return;
    }
    var bus = b.val();
    buses[b.name()].setLatLng(new L.LatLng(bus.lat, bus.lon));
    console.log("changed", b.val(), b.name());
  });

  // When the bus goes away
  f.on("child_removed", function (b) {
    if(!buses[b.name()]) {
      return;
    }
    map.removeLayer(buses[b.name()]);
  });

});
