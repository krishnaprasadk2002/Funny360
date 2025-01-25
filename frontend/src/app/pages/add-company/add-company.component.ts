import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, Validators } from '@angular/forms';
import { ReactiveFormsModule }   from '@angular/forms';
import { TreeSelectModule } from 'primeng/treeselect';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';

interface BuisnessNature {
  value: string;
  code: string;
}

@Component({
  selector: 'app-add-company',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TreeSelectModule,
    DropdownModule, 
    ButtonModule,
    SelectModule
  ],
  templateUrl: './add-company.component.html',
  styleUrl: './add-company.component.css'
})

export class AddCompanyComponent {
  tabs:any[] = ["Company Info","Shares Info","Directors","Company Secretary"];
  activeTabIndex = 0;
  companyInfoForm!: FormGroup;
  selectedNodes: string="";
  selectedCountry =""
  countries:any[] = [
    { name: 'Australia', code: 'AU' },
    { name: 'Brazil', code: 'BR' },
    { name: 'China', code: 'CN' },
    { name: 'Egypt', code: 'EG' },
    { name: 'France', code: 'FR' },
    { name: 'Germany', code: 'DE' },
    { name: 'India', code: 'IN' },
    { name: 'Japan', code: 'JP' },
    { name: 'Spain', code: 'ES' },
    { name: 'United States', code: 'US' }
];

  buisnessNature = [{
    value: "Crop and animal production, hunting.",
    code: "001"
}, {
    value: "Forestry activities",
    code: "002"
}, {
    value: "Fishing and aquaculture",
    code: "003"
}, {
    value: "Mining of coal and lignite",
    code: "005"
}, {
    value: "Extraction of crude petroleum and natural gas",
    code: "006"
}, {
    value: "Mining of metal ores",
    code: "007"
}, {
    value: "Quarrying and other mining of non-metal ores",
    code: "008"
}, {
    value: "Mining support service activities",
    code: "009"
}, {
    value: "Manufacture of food products",
    code: "010"
}, {
    value: "Manufacture of beverages",
    code: "011"
}, {
    value: "Manufacture of tobacco products",
    code: "012"
}, {
    value: "Manufacture of textiles",
    code: "013"
}, {
    value: "Manufacture of wearing apparel",
    code: "014"
}, {
    value: "Manufacture of leather and related products",
    code: "015"
}, {
    value: "Manufacture of wood and of products of wood and cork, articles of straw and plaiting materials (except furniture and toys)",
    code: "016"
}, {
    value: "Manufacture of paper and paper products",
    code: "017"
}, {
    value: "Printing and reproduction of recorded media",
    code: "018"
}, {
    value: "Manufacture of coke and refined petroleum products",
    code: "019"
}, {
    value: "Manufacture of chemicals and chemical products",
    code: "020"
}, {
    value: "Manufacture of pharmaceuticals, medicinal chemical and botanical products",
    code: "021"
}, {
    value: "Manufacture of rubber and plastics products (except furniture, toys, sports goods and stationery)",
    code: "022"
}, {
    value: "Manufacture of other non-metallic mineral products",
    code: "023"
}, {
    value: "Manufacture of basic metals",
    code: "024"
}, {
    value: "Manufacture of fabricated metal products (except machinery and equipment)",
    code: "025"
}, {
    value: "Manufacture of computer, electronic and optical products",
    code: "026"
}, {
    value: "Manufacture of electrical equipment",
    code: "027"
}, {
    value: "Manufacture of machinery and equipment n.e.c.",
    code: "028"
}, {
    value: "Body assembly of motor vehicles",
    code: "029"
}, {
    value: "Manufacture of other transport equipment",
    code: "030"
}, {
    value: "Manufacture of furniture",
    code: "031"
}, {
    value: "Other manufacturing",
    code: "032"
}, {
    value: "Repair and installation of machinery and equipment",
    code: "033"
}, {
    value: "Electrcity and Gas Supply",
    code: "035"
}, {
    value: "Water collection, treatment and supply",
    code: "036"
}, {
    value: "Sewerage",
    code: "037"
}, {
    value: "Waste collection, treatment and disposal activities; materials recovery",
    code: "038"
}, {
    value: "Remediation activities and other waste management services",
    code: "039"
}, {
    value: "Construction of buildings",
    code: "041"
}, {
    value: "Civil engineering",
    code: "042"
}, {
    value: "Specialised Construction Activities",
    code: "043"
}, {
    value: "Import and export trade ",
    code: "045"
}, {
    value: "Wholesale",
    code: "046"
}, {
    value: "Retail Trade",
    code: "047"
}, {
    value: "Land Transport",
    code: "049"
}, {
    value: "Water Transport",
    code: "050"
}, {
    value: "Air Transport",
    code: "051"
}, {
    value: "Warehousing and support activities for transportation",
    code: "052"
}, {
    value: "Postal and courier activities",
    code: "053"
}, {
    value: "Short term accommodation activities",
    code: "055"
}, {
    value: "Food and beverage service activities",
    code: "056"
}, {
    value: "Publishing activities",
    code: "058"
}, {
    value: "Motion picture, video and television programme production, sound recording and music publishing activities",
    code: "059"
}, {
    value: "Programming and broadcasting activities",
    code: "060"
}, {
    value: "Telecommunications",
    code: "061"
}, {
    value: "Information technology service activities",
    code: "062"
}, {
    value: "Information service activities",
    code: "063"
}, {
    value: "Financial service activities, including investment and holding companies, and the activities of trusts, funds and similar financial entities.",
    code: "064"
}, {
    value: "Insurance (including pension funding) ",
    code: "065"
}, {
    value: "Activities auxiliary to financial service and insurance activities",
    code: "066"
}, {
    value: "Real estate activities",
    code: "068"
}, {
    value: "Legal and accounting activities",
    code: "069"
}, {
    value: "Activities of head offices; management and management consultancy activities",
    code: "070"
}, {
    value: "Architecture and engineering activities, technical testing and analysis",
    code: "071"
}, {
    value: "Scientific research and development",
    code: "072"
}, {
    value: "Veterinary activities",
    code: "073"
}, {
    value: "Advertising and market research",
    code: "074"
}, {
    value: "Other professional, scientific and technical activities",
    code: "075"
}, {
    value: "Rental and leasing activities",
    code: "077"
}, {
    value: "Employment activities",
    code: "078"
}, {
    value: "Travel agency, reservation service and related activities",
    code: "079"
}, {
    value: "Security and investigation activities ",
    code: "080"
}, {
    value: "Services to buildings and landscape care activities",
    code: "081"
}, {
    value: "Office administrative, office support and other business support activities",
    code: "082"
}, {
    value: "Public administration",
    code: "084"
}, {
    value: "Education",
    code: "085"
}, {
    value: "Human health activities",
    code: "086"
}, {
    value: "Residential care activities",
    code: "087"
}, {
    value: "Social work activities without accommodation",
    code: "088"
}, {
    value: "Creative and performing arts activities",
    code: "090"
}, {
    value: "Libraries, archives, museums and other cultural activities",
    code: "091"
}, {
    value: "Activities of amusement parks and theme parks",
    code: "092"
}, {
    value: "Sports and other entertainment activities",
    code: "093"
}, {
    value: "Activities of membership organisations",
    code: "094"
}, {
    value: "Repair of motor vehicles, motorcycles, computers, personal and household goods",
    code: "095"
}, {
    value: "Other personal service activities",
    code: "096"
}, {
    value: "Activities of households as employers of domestic personnel",
    code: "097"
}, {
    value: "Goods and services producing activities of private households for own use ",
    code: "098"
}, {
    value: "Activities of extraterritorial organisations and bodies",
    code: "099"
}]




  private fb = inject(FormBuilder)

  ngOnInit() {
    this.companyInfoForm = this.fb.group({
      companyNameEN:new FormControl('',[Validators.required]),
      companyNameCN:new FormControl('',[Validators.required]),
      companyType:new FormControl('',[Validators.requiredTrue]),
      natureofCompany: new FormControl<BuisnessNature | null>(null),
      code: new FormControl('', [Validators.required])
    })

        // Listen for changes on the `natureofCompany` field
        this.companyInfoForm.get('natureofCompany')?.valueChanges.subscribe((selectedNature: BuisnessNature | null) => {
          // If a nature is selected, update the code field with the code from the selected nature

          console.log(selectedNature);
          
          if (selectedNature) {
            this.companyInfoForm.get('code')?.setValue(selectedNature.code);
          } else {
            this.companyInfoForm.get('code')?.setValue(''); // Clear the code field if no nature is selected
          }
        });

  }


  changeTab(index: number){
     this.activeTabIndex = index  
  }


  test(){
    console.log(this.companyInfoForm.value);
    
  }
  submitCompanyInfo(){

  }

  onNatureofCompany(event:Event){
    console.log(event);
      // Optionally update your form value
  // this.companyInfoForm.patchValue({
  //   natureofCompany: event.value
  // });
  }
}
