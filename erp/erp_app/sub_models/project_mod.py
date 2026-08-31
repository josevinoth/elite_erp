from .project import Project


class ProjectInfo(Project):
    class Meta:
        proxy = True
        verbose_name = "Project"
        verbose_name_plural = "Projects"

