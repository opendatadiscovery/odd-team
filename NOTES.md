

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
   - If the doc has missing information about vision and architecture
   - If there are missing "blocks" of functionality in the docs it should be fixed
   - If there are missing "notes" for the implementation about corner cases and known limitations it should be fixed
   - If feature is described with outdates or not correct information it should be fixed
   - If there are no references from docs to code entry-points it should be fixed 
   - If there are no keywords for the documentation it should be fixed
   - If there are missing references to Issues and Release for feature
2. Assess existing codebase at all the repositories with code at https://github.com/opendatadiscovery but primarily for https://github.com/opendatadiscovery/odd-platform and https://github.com/opendatadiscovery/odd-collectors (copied to the parent folder of this folder, the local version could be out of sync with the remote)
   - If there are places in code that are not covered with tests we should add tests;
   - If there are places in code that make if difficult to navigate from one connected place to another, or from feature description to feature implementation we should add comments and refactor code with no impact on the implementation;
3. Assess Open Data Discovery Specification https://github.com/opendatadiscovery/opendatadiscovery-specification
   - If the description of Ingress API has gap compared to https://github.com/opendatadiscovery/opendatadiscovery-specification/tree/main/specification the description should be updated;  

It's obvious that it'll be not possible to complete these steps in one go by any Claude Code - we have too many pieces of code and documentation, with a lot of references, issues in tests, docs and code.
So we have first to find out a solution that could be used to run this solution in a sustainable way so that we could create full list of the items to be implemented to close the gap in docs, tests, code refactoring without functional changes. We need this list for:
1. We could review it first before the beginning of the implementation;
2. We could keep track of all linked places and not to constantly overwrite one edit with another;
3. We could implement the changes in parallel where applicable and in a shorter sessions to not overwhelm one session with context.

I would only also add a remark that current documentation for the existing features could be incorrect or not full, so we should also identify and close this gap. We should also design and implement the means for the code and feature navigations, as there are a lot of features, many repositories, huge code base, we should help to navigate for "ODD Team" in case we need to implements something new, it should not make to scan too much text in each session as we'll overwhelm sessions and consume too many tokens.


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


## Final Aim for this repository

This repo should be used to create a Team of AI Maintainers for the Open Data Discovery project that:
1. Could maintain documentation, codebase, tests in a traceable, maintainable, useful way;
2. Implement change requests from the users including the complexity and dependency analysis, prioritization considerations, etc.;
3. Answer to the questions from the users regarding features, implementations, deployments options, etc. 

We could use multi-agent, multi-skills environment for that.
We could use for reference different approached like:
1. https://github.com/provectus/awos;
2. https://github.com/provectus/awos-recruitment;
3. https://github.com/gsd-build/get-shit-done


