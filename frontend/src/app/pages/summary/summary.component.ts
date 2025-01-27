import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-summary',
  imports: [],
  templateUrl: './summary.component.html',
  styleUrl: './summary.component.css'
})
export class SummaryComponent {
  companyId!: string;
  private route=inject(ActivatedRoute)

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.companyId = params['companyId'];
      console.log('Company ID:', this.companyId);
    });
}
}