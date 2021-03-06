import admin from 'cypress/fixtures/users/admin.json';
import match from 'cypress/fixtures/match.json';
import school from 'cypress/fixtures/orgs/school.json';

function matchIsListed(): void {
  cy.getBySel('match-row')
    .should('have.length', 1)
    .and('contain', `${match.people[0].name} (${match.people[0].roles[0]})`)
    .and('contain', `${match.people[1].name} (${match.people[1].roles[0]})`)
    .and('contain', match.subjects[0])
    .and('contain', match.message);
}

describe('Matches dashboard page', () => {
  beforeEach(() => {
    cy.setup();
    cy.login(admin.id);
    cy.visit(`/${school.id}/matches`);
  });

  // TODO: Test the appointment logging flow, the nested user pages, etc.
  it('shows match info in dialog', () => {
    cy.wait('@get-account');

    cy.getBySel('title').should('have.text', 'Matches');
    cy.getBySel('subtitle').should(
      'have.text',
      `${school.name}'s student-tutor-mentor matches`
    );

    cy.contains('button', 'Import data').click();

    cy.wait('@list-matches');
    matchIsListed();

    cy.get('[placeholder="Search matches"]').type('Computer');

    cy.wait('@list-matches');
    matchIsListed();

    cy.getBySel('match-row').click();
    cy.getBySel('match-dialog', { timeout: 60000 }).should('be.visible');
  });
});
