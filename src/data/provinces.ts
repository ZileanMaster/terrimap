export interface Province {
  name: string
  lat:  number
  lng:  number
  zoom: number
}

export const VIETNAM_PROVINCES: Province[] = [
  // Bắc
  { name: 'Hà Nội',     lat: 21.0285, lng: 105.8542, zoom: 11 },  
  { name: 'Hải Phòng',  lat: 20.8449, lng: 106.6881, zoom: 12 },  
  { name: 'Quảng Ninh', lat: 21.0064, lng: 107.2925, zoom: 11 },  
  { name: 'Cao Bằng',   lat: 22.6666, lng: 106.2638, zoom: 11 },  
  { name: 'Lạng Sơn',   lat: 21.8537, lng: 106.7614, zoom: 11 },  
  { name: 'Điện Biên',  lat: 21.3860, lng: 103.0177, zoom: 11 },  
  { name: 'Sơn La',     lat: 21.3256, lng: 103.9140, zoom: 11 },  
  { name: 'Lai Châu',   lat: 22.3964, lng: 103.4580, zoom: 11 },  
  { name: 'Lào Cai',    lat: 22.4856, lng: 103.9754, zoom: 11 },  
  { name: 'Tuyên Quang',lat: 21.7767, lng: 105.2280, zoom: 11 },  
  { name: 'Thái Nguyên',lat: 21.5942, lng: 105.8480, zoom: 11 },  
  { name: 'Phú Thọ',    lat: 21.3450, lng: 105.2415, zoom: 11 },  
  { name: 'Bắc Ninh',   lat: 21.1861, lng: 106.0763, zoom: 12 },  
  { name: 'Ninh Bình',  lat: 20.2506, lng: 105.9745, zoom: 12 },  

  // Trung 
  { name: 'Thanh Hóa',  lat: 19.8079, lng: 105.7851, zoom: 11 },  
  { name: 'Nghệ An',    lat: 19.2342, lng: 104.9200, zoom: 11 },  
  { name: 'Hà Tĩnh',    lat: 18.3559, lng: 105.8877, zoom: 11 },  
  { name: 'Quảng Bình', lat: 17.4689, lng: 106.6219, zoom: 11 },  
  { name: 'Huế',        lat: 16.4637, lng: 107.5909, zoom: 12 },  
  { name: 'Đà Nẵng',    lat: 16.0471, lng: 108.2068, zoom: 12 },  
  { name: 'Quảng Ngãi', lat: 15.1214, lng: 108.8076, zoom: 11 },  
  { name: 'Phú Yên',    lat: 13.0882, lng: 109.0929, zoom: 11 },  
  { name: 'Lâm Đồng',   lat: 11.9465, lng: 108.4420, zoom: 11 },  
  { name: 'Gia Lai',    lat: 13.9816, lng: 108.0000, zoom: 11 }, 
  { name: 'Đắk Lắk',   lat: 12.7100, lng: 108.2378, zoom: 11 },  

  // Nam
  { name: 'Hồ Chí Minh',lat: 10.7769, lng: 106.7009, zoom: 11 },  
  { name: 'Đồng Nai',   lat: 10.9453, lng: 106.8345, zoom: 11 }, 
  { name: 'Long An',    lat: 10.6956, lng: 106.2431, zoom: 11 },  
  { name: 'Đồng Tháp',  lat: 10.4938, lng: 105.6882, zoom: 11 },  
  { name: 'Vĩnh Long',  lat: 10.2397, lng: 105.9571, zoom: 12 },  
  { name: 'Cần Thơ',    lat: 10.0452, lng: 105.7469, zoom: 12 },  
  { name: 'Kiên Giang', lat:  9.8251, lng: 105.1259, zoom: 11 },  
]
