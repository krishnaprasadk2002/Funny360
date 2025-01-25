import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-user-dashboard',
  imports: [CommonModule],
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.css',
})
export class UserDashboardComponent {
  activeTab: any = 'project';
  private router=inject(Router)
  ngOnInit(): void {
    console.log(this.activeTab);
  }

  onHandleTabChange(tabName: any) {
    this.activeTab = tabName;
    console.log(this.activeTab);
  }

  navigateToProjectForm() {
    this.router.navigate(['/project-form']); 
  }
}
