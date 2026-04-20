

## Code vs. Documentation References
* Reference from features to code entry points of implementation;
* Comments in code for search and navigation;
* Reference from features to Issues and releases.
* Notes for known limitations and bugs;
* References to ADR in Issues for implementation details 
* Keywords in code and documentation to ease search and navigation
* Cross-References among features

### Problem Statement
We need to:
1. Assess existing gitbook documentation at https://github.com/opendatadiscovery/odd-docs
   - If there are missing "blocks" of functionality in the docs it should be fixed
   - If there are missing "notes" for the implementation about corner cases and known limitations it should be fixed
   - If feature is described with outdates or not correct information it should be fixed
   - If there are no references from docs to code entry-points it should be fixed 
   - If there are no keywords for the documentation it should be fixed
   - If there are missing references to Issues and Release for feature
2. Assess existing codebase at all the repositories with code at https://github.com/opendatadiscovery but primarily for https://github.com/opendatadiscovery/odd-platform and https://github.com/opendatadiscovery/odd-collectors:
   - If there are places in code that are not covered with tests;
   - If there are places in code that make if difficult to navigate from one connected place to another, or from feature description to feature implementation;

   
## Ideas for Architectural Decision Records
* Backward incompatible changes should be avoided until absolutely necessary;
* Be honest, nobody is ideal, but we should chase engineering perfection: there are a lot of “historical” reasons for implementations and design decisions, we are not going to change everything in one go, we only fix super necessary parts and log others as issues for later considerations;
* We heavily rely on PostgreSQL capabilities, wherever possible we use PostgreSQL-native implementations;
* The global vision is to cover every aspect of data and ai governance: data discovery, data lineage, data glossary, data quality, data modeling, data cost, reference data management, data security;


## Pillars for Sustainable development with AI Assistance
1. Existing Features should be concisely but fully described to convey information how the system works to provide the mean for Validation;
2. There should all possible tests implemented and running to be the mean for Verification;
3. All change requests should be tracked by GitHub to follow the intent, supported by comments where considirations are mentioned, cross-references for other issues are logged, where references for relevant ADRs are mentioned, and code chnages is tracked via references to Pull Requests; 
4. There should be an easy way to understand the initial intention of the change request described in an Issue, enrich it in the comments to an Issue with considerations regarding vision of the products, existing functionality, ADRs other logged issues, there should be a follow-up in comments to an issues with clarification questions; 


## Information Locations

1. Medium blog posts - detailed description
   - use case specific
   - number of features working together
   - Manuals (screenshots, how-to)
   - Links to gitbook


2. gitbook - tech doc
   - listing of features
   - architectures
   - concise
   - technical details
   - known limitations
   - related GitHub issues
   - reference to Medium blog posts
   - Platform Ingress API doc
   - Platform OpenAPI doc
   

3. Issues - change request management 
      - hierarchy for complex change requests 
      - discussions
      - references to Pull Requests
      

4. Pull Requests - Implementation details
      - Concise comments
      - links to related Issues


5. Tests - validation and verification of implementation
      - part of PR
   

6. Open Data Discovery Specification - ODD Ingress


7. Awesome Catalog - features comparison with alternatives


8. LinkedIn Account - Public Relationships
   - Anouncements
   - Leadership Thoughts
   - Vision
   
   
9. Slack Workspace - Community Support
   - Reamediation 
   - Q&A
   - Accouncements


