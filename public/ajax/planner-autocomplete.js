var countryList = document.getElementById('country-options');
var cityList = document.getElementById('city-options');

var allCountries = [];

function updateCountryOptions(countries) {
  countryList.innerHTML = '';
  for (var i = 0; i < countries.length; i++) {
    var option = document.createElement('option');
    option.value = countries[i];
    countryList.appendChild(option);
  }
}

function updateCityOptions(cities) {
  cityList.innerHTML = '';
  for (var i = 0; i < cities.length; i++) {
    var option = document.createElement('option');
    option.value = cities[i];
    cityList.appendChild(option);
  }
}

//country list
fetch("https://restcountries.com/v3.1/all?fields=name")
  .then((response) => response.json())
  .then((data) => {
    for (var i = 0; i < data.length; i++) {
      if (data[i] && data[i].name && data[i].name.common) {
        allCountries.push(data[i].name.common);
      }
    }
    allCountries.sort();
  });

document.addEventListener('input', function (e) {
  // country input
  if (e.target.getAttribute('list') === 'country-options') {
    var searchText = e.target.value.toLowerCase();

    if (searchText.length === 0) {
      updateCountryOptions([]);
      return;
    }

    var filtered = [];
    for (var j = 0; j < allCountries.length; j++) {
      var countryName = allCountries[j].toLowerCase();
      if (countryName.indexOf(searchText) === 0) {  // filter just countries start with that letter
        filtered.push(allCountries[j]);
      }
    }
    updateCountryOptions(filtered);
  }

  // City input
  if (e.target.getAttribute('list') === 'city-options') {
    var searchTextCity = e.target.value;

    if (searchTextCity.length < 2) {
      updateCityOptions([]);
      return;
    }

    //city list
    fetch("https://geocoding-api.open-meteo.com/v1/search?name="
      + searchTextCity + "&count=10&language=en")
      .then((response) => response.json())
      .then((data) => {

        var cities = [];
        if (data && data.results) {
          for (var i = 0; i < data.results.length; i++) {
            var cityName = data.results[i].name;
            if (data.results[i].country_code) {
                  cityName = cityName + ", " + data.results[i].country_code;
              }
                cities.push(cityName);
              }}

        updateCityOptions(cities);
      });
  }
});